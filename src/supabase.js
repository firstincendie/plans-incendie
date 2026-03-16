import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://custkyapdbvzkuxgurla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1c3RreWFwZGJ2emt1eGd1cmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzM3OTgsImV4cCI6MjA4OTIwOTc5OH0.Hk4cC6V_f2ZWr147m1k8Q5tACP1F8ZFep_M6s0pY-bA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);