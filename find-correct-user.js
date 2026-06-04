import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function findCorrectUser() {
  try {
    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/merchantdb';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const merchantid = "MIDd7MVC7tSPOPwt2HBamU6";
    const targetEmail = "barasajimmy699@gmail.com";

    console.log(`\n🔍 Finding all users with merchant ID: ${merchantid}\n`);

    // Find all users with this merchant ID
    const users = await User.find({ merchantid });
    
    console.log(`Found ${users.length} users with this merchant ID:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. User Details:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Name: ${user.fullname}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Is Target User: ${user.email === targetEmail ? '✅ YES' : '❌ NO'}`);
      console.log('');
    });

    // Find the specific user from the token
    const targetUser = users.find(user => user.email === targetEmail);
    
    if (targetUser) {
      console.log('🎯 Found the target user from your token:');
      console.log(`   ID: ${targetUser._id}`);
      console.log(`   Name: ${targetUser.fullname}`);
      console.log(`   Email: ${targetUser.email}`);
      console.log(`   Role: ${targetUser.role}`);
      console.log(`   Onboarding Status: ${targetUser.onboardingStatus}`);
      console.log('\n📋 User Onboarding Steps:');
      console.log(JSON.stringify(targetUser.onboardingSteps, null, 2));
    } else {
      console.log('❌ Target user not found with this merchant ID');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

findCorrectUser();










