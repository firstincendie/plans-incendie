import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://custkyapdbvzkuxgurla.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j2mShNi_GJMtllLxpXOkPg_GZRmFXL4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);