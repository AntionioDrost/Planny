const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in env');
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function generateMock(name, email) {
    let user;
    const { data, error } = await supabase.auth.signUp({
        email,
        password: 'password123',
        options: { data: { display_name: name } }
    });

    if (error) {
        // If already registered, sign in to get the ID
        const { data: signInData } = await supabase.auth.signInWithPassword({ email, password: 'password123' });
        if (signInData?.user) {
            user = signInData.user;
        } else {
            console.log(`Failed to create/login ${name}:`, error.message);
            return;
        }
    } else {
        user = data.user;
    }

    const userId = user.id;
    const token = Math.random().toString(36).substring(2, 10);
    const qrData = JSON.stringify({ userId, token });

    console.log(`\n\n=== Scan this to connect with ${name} ===\n`);
    qrcode.generate(qrData, { small: true });
}

async function run() {
    await generateMock('Lisa', 'lisa@plannyapp.com');
    await generateMock('Gwenneth', 'gwenneth@plannyapp.com');
    console.log('\n\nScanner active! Point your camera at these codes.');
}

run();
