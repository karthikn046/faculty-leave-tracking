import { supabase } from './supabaseClient';

/**
 * Sign up a new user with email and password
 */
export async function signUpUser(email, password, role, name, department) {
  try {
    // Create auth account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          name,
          department,
        }
      }
    });

    if (error) throw error;
    return { success: true, user: data.user, message: "Signed up successfully! Please log in." };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Sign in with email and password
 */
export async function signInUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Fetch user profile from the users table
    const profile = await getUserProfile(data.user.id);
    
    return { 
      success: true, 
      user: data.user,
      profile: profile,
      message: "Logged in successfully!" 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current user session
 */
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { session: data.session, error: null };
  } catch (error) {
    return { session: null, error: error.message };
  }
}

/**
 * Get user profile from users table
 */
export async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.log("Profile not found:", error.message);
    return null;
  }
}

/**
 * Create/update user profile in the users table
 */
export async function upsertUserProfile(userId, role, name, department) {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          role,
          name,
          department,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}
