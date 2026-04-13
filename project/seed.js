const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log('Connected');

	await User.deleteMany({ username: { $in: ['alice', 'bob', 'admin'] } });

	await User.insertMany([
		{ username: 'alice', password: 'pass1', role: 'user', quotaLimit: 524288000 },
		{ username: 'bob', password: 'pass2', role: 'user', quotaLimit: 524288000 },
		{ username: 'admin', password: 'admin123', role: 'admin', quotaLimit: 524288000 },
	]);

	console.log('Seeded alice, bob, and admin');
	await mongoose.disconnect();
}

seed().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
