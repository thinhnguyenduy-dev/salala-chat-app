import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (optional - comment out if you want to keep existing data)
  await prisma.messageRead.deleteMany();
  await prisma.conversationRead.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.friendRequest.deleteMany();
  await prisma.user.deleteMany();

  // Create 30 users
  const users = [];
  const hashedPassword = await bcrypt.hash('password123', 10);

  const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'Tom', 'Anna', 'James', 'Mary', 'Robert', 'Linda', 'Michael', 'Patricia', 'William', 'Jennifer', 'Richard', 'Elizabeth', 'Daniel', 'Susan', 'Thomas', 'Jessica', 'Charles', 'Karen', 'Joseph', 'Nancy', 'Christopher', 'Betty'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];

  for (let i = 0; i < 30; i++) {
    const firstName = firstNames[i];
    const lastName = lastNames[i];
    const user = await prisma.user.create({
      data: {
        username: `${firstName.toLowerCase()}${lastName.toLowerCase()}${i + 1}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@example.com`,
        password: hashedPassword,
        displayName: `${firstName} ${lastName}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}`,
        status: i % 3 === 0 ? 'online' : 'offline', // 1/3 online, 2/3 offline
        friendIds: [],
      },
    });
    users.push(user);
  }

  console.log(`✅ Created ${users.length} users`);

  // Create friendships (each user has 5-10 random friends)
  for (const user of users) {
    const numFriends = Math.floor(Math.random() * 6) + 5; // 5-10 friends
    const potentialFriends = users.filter(u => u.id !== user.id);
    const selectedFriends = potentialFriends
      .sort(() => Math.random() - 0.5)
      .slice(0, numFriends);

    const friendIds = selectedFriends.map(f => f.id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        friendIds: {
          set: [...new Set([...user.friendIds, ...friendIds])],
        },
      },
    });

    // Update friends' friendIds to include this user (mutual friendship)
    for (const friend of selectedFriends) {
      await prisma.user.update({
        where: { id: friend.id },
        data: {
          friendIds: {
            set: [...new Set([...friend.friendIds, user.id])],
          },
        },
      });
    }
  }

  console.log('✅ Created friend relationships');

  // Create 10 group conversations
  for (let i = 0; i < 10; i++) {
    const numParticipants = Math.floor(Math.random() * 5) + 3; // 3-7 participants
    const participants = users
      .sort(() => Math.random() - 0.5)
      .slice(0, numParticipants);

    const conversation = await prisma.conversation.create({
      data: {
        name: `Group ${i + 1} - ${['Study', 'Work', 'Friends', 'Family', 'Gaming', 'Sports', 'Music', 'Travel', 'Food', 'Tech'][i]}`,
        isGroup: true,
        participantIds: participants.map(p => p.id),
      },
    });

    // Add 5-15 messages to each group
    const numMessages = Math.floor(Math.random() * 11) + 5;
    for (let j = 0; j < numMessages; j++) {
      const sender = participants[Math.floor(Math.random() * participants.length)];
      const messages = [
        'Hello everyone!',
        'How are you doing?',
        'Anyone free this weekend?',
        'Check out this cool link!',
        'Great meeting today!',
        'Thanks for the help!',
        'See you tomorrow!',
        'Happy to be here!',
        'What do you think?',
        'Sounds good to me!',
        'Let me know if you need anything',
        'I agree with that',
        'Interesting point!',
        'Can we schedule a meeting?',
        'Looking forward to it!',
      ];

      await prisma.message.create({
        data: {
          content: messages[Math.floor(Math.random() * messages.length)],
          conversationId: conversation.id,
          senderId: sender.id,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last 7 days
        },
      });
    }
  }

  console.log('✅ Created 10 group conversations with messages');

  // Create private conversations between friends
  let privateConvCount = 0;
  for (let i = 0; i < users.length && privateConvCount < 20; i++) {
    const user = users[i];
    const friends = users.filter(u => user.friendIds.includes(u.id));

    for (let j = 0; j < Math.min(2, friends.length) && privateConvCount < 20; j++) {
      const friend = friends[j];

      // Check if conversation already exists
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          participantIds: {
            hasEvery: [user.id, friend.id],
          },
        },
      });

      if (!existing) {
        const conversation = await prisma.conversation.create({
          data: {
            isGroup: false,
            participantIds: [user.id, friend.id],
          },
        });

        // Add 3-8 messages
        const numMessages = Math.floor(Math.random() * 6) + 3;
        for (let k = 0; k < numMessages; k++) {
          const sender = k % 2 === 0 ? user : friend;
          const privateMessages = [
            'Hey! How have you been?',
            'Long time no see!',
            'Want to grab coffee?',
            'Did you see the news?',
            'I was thinking about you',
            'Thanks for yesterday!',
            'You free this week?',
            'Miss you!',
            'Hope you are well',
            'Let me know when you are free',
          ];

          await prisma.message.create({
            data: {
              content: privateMessages[Math.floor(Math.random() * privateMessages.length)],
              conversationId: conversation.id,
              senderId: sender.id,
              createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            },
          });
        }

        privateConvCount++;
      }
    }
  }

  console.log(`✅ Created ${privateConvCount} private conversations with messages`);

  console.log('🎉 Seeding completed successfully!');
  console.log('\n📝 Test credentials:');
  console.log('   Email: john.smith1@example.com');
  console.log('   Password: password123');
  console.log('\n   (All users have password: password123)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
