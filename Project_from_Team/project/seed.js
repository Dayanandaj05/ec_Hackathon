const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected');

  await User.deleteMany({ username: { $in: ['alice', 'bob'] } });

  await User.insertMany([
    { username: 'alice', password: 'pass1', quotaLimit: 52428800 },
    { username: 'bob',   password: 'pass2', quotaLimit: 52428800 },
  ]);

  console.log('✅ Seeded: alice and bob created!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });