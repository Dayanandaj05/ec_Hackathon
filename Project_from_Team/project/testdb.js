require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(() => { console.log('✅ Atlas connected!'); process.exit(0); })
  .catch(err => { console.error('❌ Error:', err.message); process.exit(1); });