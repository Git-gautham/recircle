/* ReCircle — Supabase identity and profile integration */

const SUPABASE_URL = "https://axcpgigdwmhumvcuiqoy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rWsjinK472VdSOfh3J3yeQ_ulCT_6yF";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const Auth = (() => {
  let session = null;
  let profile = null;

  function user() { return session?.user || null; }
  function isSignedIn() { return Boolean(user()); }
  function localProfile() {
    const me = Store.me();
    return {
      id: user()?.id || ME,
      name: profile?.display_name || me.name,
      role: profile?.role || me.role,
      place: profile?.place || me.place,
      lat: profile?.lat ?? me.lat,
      lng: profile?.lng ?? me.lng
    };
  }

  async function loadProfile() {
    if (!user()) return;
    ME = user().id;
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, display_name, role, place, lat, lng")
      .eq("id", user().id)
      .maybeSingle();
    if (error) throw error;
    profile = data;
    if (data) Store.saveMe({
      id: data.id, name: data.display_name || user().email?.split("@")[0] || "ReCircle user",
      role: data.role || "individual", place: data.place || "",
      lat: data.lat ?? DEFAULT_CENTER.lat, lng: data.lng ?? DEFAULT_CENTER.lng
    });
  }

  async function saveProfile(patch) {
    if (!user()) throw new Error("Please sign in first.");
    const next = {
      id: user().id,
      display_name: String(patch.name || "").trim() || "ReCircle user",
      role: ["individual", "student", "recycler", "business"].includes(patch.role) ? patch.role : "individual",
      place: String(patch.place || "").trim(),
      lat: Number(patch.lat ?? Store.me().lat),
      lng: Number(patch.lng ?? Store.me().lng)
    };
    const { data, error } = await supabaseClient.from("profiles").upsert(next).select().single();
    if (error) throw error;
    profile = data;
    Store.saveMe({ id: data.id, name: data.display_name, role: data.role, place: data.place, lat: data.lat, lng: data.lng });
    document.dispatchEvent(new CustomEvent("profilechange"));
  }

  async function signIn(email, password) {
    const result = await supabaseClient.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    session = result.data.session;
    ME = session?.user?.id || "me";
    await loadProfile();
  }

  async function signUp(email, password, name) {
    const result = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: new URL("./", window.location.href).href
      }
    });
    if (result.error) throw result.error;
    if (result.data.session) {
      session = result.data.session;
      ME = session.user.id;
      await saveProfile({ name, role: "individual", place: "" });
    }
    return result.data.session;
  }

  async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    session = null; profile = null;
    ME = "me";
    Store.reset();
    location.reload();
  }

  async function init() {
    const result = await supabaseClient.auth.getSession();
    if (result.error) throw result.error;
    session = result.data.session;
    ME = session?.user?.id || "me";
    if (session) await loadProfile();
    supabaseClient.auth.onAuthStateChange((_event, next) => {
      session = next;
      ME = next?.user?.id || "me";
      document.dispatchEvent(new CustomEvent("authchange"));
    });
  }

  return { init, user, isSignedIn, localProfile, saveProfile, signIn, signUp, signOut };
})();
