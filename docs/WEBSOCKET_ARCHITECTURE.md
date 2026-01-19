# WebSocket Architecture

This document provides a comprehensive overview of how WebSocket communication works in the Salala chat application.

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Backend | NestJS WebSocket Gateway | v11.x |
| Protocol | Socket.IO | v4.8.3 |
| Frontend | socket.io-client | v4.8.3 |
| Presence Store | Redis | ioredis |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                                     │
│  ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────────────────┐  │
│  │ React Components │───▶│   useSocket Hook  │───▶│   useChatStore (Zustand)     │  │
│  └──────────────────┘    └─────────┬─────────┘    └──────────────────────────────┘  │
└────────────────────────────────────┼────────────────────────────────────────────────┘
                                     │
                                     │ Socket.IO (WebSocket)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (NestJS)                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                            ChatGateway                                       │   │
│  └───────────┬──────────────────────┬────────────────────────┬──────────────────┘   │
│              │                      │                        │                      │
│              ▼                      ▼                        ▼                      │
│  ┌───────────────────┐  ┌───────────────────┐   ┌────────────────────────┐          │
│  │   Redis Service   │  │   Prisma Service  │   │  Notification Service  │          │
│  └─────────┬─────────┘  └─────────┬─────────┘   └───────────┬────────────┘          │
└────────────┼──────────────────────┼─────────────────────────┼───────────────────────┘
             │                      │                         │
             ▼                      ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL SERVICES                                        │
│  ┌────────────────┐     ┌─────────────────┐     ┌─────────────────────────────┐     │
│  │    Redis DB    │     │   PostgreSQL    │     │  Firebase Cloud Messaging   │     │
│  └────────────────┘     └─────────────────┘     └─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Connection Lifecycle

### 1. Connection Establishment

When a user authenticates, the frontend establishes a WebSocket connection:

```
  Client              ChatGateway           JwtService          RedisService         PostgreSQL
    │                      │                     │                    │                    │
    │  Connect(token)      │                     │                    │                    │
    │─────────────────────▶│                     │                    │                    │
    │                      │  Verify token       │                    │                    │
    │                      │────────────────────▶│                    │                    │
    │                      │  Payload {sub}      │                    │                    │
    │                      │◀────────────────────│                    │                    │
    │                      │                     │                    │                    │
    │                      │  Find user by ID    │                    │                    │
    │                      │────────────────────────────────────────────────────────────▶│
    │                      │  User data          │                    │                    │
    │                      │◀────────────────────────────────────────────────────────────│
    │                      │                     │                    │                    │
    │                      │  setUserOnline(userId, socketId)         │                    │
    │                      │───────────────────────────────────────▶│                    │
    │                      │                     │                    │                    │
    │  Join room (userId)  │                     │                    │                    │
    │◀─────────────────────│                     │                    │                    │
    │                      │                     │                    │                    │
    │                      │──── Broadcast: userStatusChanged {status: 'online'} ───────▶│
    │                      │                     │                    │        All Clients │
```

**Key Points:**
- JWT token is passed via query parameter: `io(URL, { query: { token } })`
- User joins their personal room (userId) for targeted notifications
- Redis tracks both `online_users` set and `user_sockets:{userId}` for multi-device support

### 2. Disconnection Handling

```
  Client              ChatGateway                       RedisService
    │                      │                                  │
    │  Disconnect          │                                  │
    │─────────────────────▶│                                  │
    │                      │  setUserOffline(userId, socketId)│
    │                      │─────────────────────────────────▶│
    │                      │  isFullyOffline (boolean)        │
    │                      │◀─────────────────────────────────│
    │                      │                                  │
    │                      │  ┌───────────────────────────────────────────┐
    │                      │  │ IF no more active connections:            │
    │                      │  │   Broadcast: userStatusChanged {offline}  │
    │                      │  │ ELSE:                                     │
    │                      │  │   No broadcast (still online elsewhere)   │
    │                      │  └───────────────────────────────────────────┘
```

**Multi-Device Support:**
- Each socket connection is tracked individually in Redis
- User only marked offline when ALL their sockets disconnect
- Enables seamless multi-device usage

---

## Event Reference

### Client → Server Events (Emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `joinRoom` | `{ conversationId: string }` | Join a conversation room |
| `sendMessage` | `{ conversationId, content, fileUrl?, replyToId? }` | Send a message |
| `typing` | `{ conversationId: string }` | Indicate typing started |
| `stopTyping` | `{ conversationId: string }` | Indicate typing stopped |
| `markMessagesAsRead` | `{ messageIds: string[] }` | Mark messages as read |

### Server → Client Events (Listen)

| Event | Payload | Description |
|-------|---------|-------------|
| `newMessage` | `IMessage` | New message received |
| `userStatusChanged` | `{ userId, status }` | User online/offline status |
| `userTyping` | `{ userId, conversationId }` | Someone is typing |
| `userStopTyping` | `{ userId, conversationId }` | Someone stopped typing |
| `messagesRead` | `{ messageIds[], userId, readAt }` | Messages marked as read |
| `newFriendRequest` | `FriendRequest` | New friend request received |
| `user:{userId}:newGroup` | `{ groupId, groupName }` | Added to a new group |

---

## Chat Features

### Message Flow

```
  Sender            ChatGateway            PostgreSQL         Conv Room          Recipient          FCM
    │                    │                      │                  │                  │              │
    │  sendMessage       │                      │                  │                  │              │
    │───────────────────▶│                      │                  │                  │              │
    │                    │  Validate user       │                  │                  │              │
    │                    │─────────────────────▶│                  │                  │              │
    │                    │◀─────────────────────│                  │                  │              │
    │                    │  Create message      │                  │                  │              │
    │                    │─────────────────────▶│                  │                  │              │
    │                    │◀─────────────────────│                  │                  │              │
    │                    │  Update lastMsgId    │                  │                  │              │
    │                    │─────────────────────▶│                  │                  │              │
    │                    │                      │                  │                  │              │
    │                    │  Emit 'newMessage' to all participants  │                  │              │
    │                    │────────────────────────────────────────▶│                  │              │
    │  newMessage        │                      │                  │  newMessage      │              │
    │◀───────────────────│◀─────────────────────────────────────────────────────────▶│              │
    │                    │                      │                  │                  │              │
    │                    │  ┌─────────────────────────────────────────────────────────────────────┐ │
    │                    │  │ IF recipient not in room: Send push notification ──────────────────────▶│
    │                    │  └─────────────────────────────────────────────────────────────────────┘ │
```

### Typing Indicators

```typescript
// Frontend - emit typing
const emitTyping = (conversationId: string) => {
  socket.emit('typing', { conversationId });
};

// Frontend - listen for typing
socket.on('userTyping', (data) => {
  window.dispatchEvent(new CustomEvent('userTyping', { detail: data }));
});
```

### Read Receipts

The application tracks read status at two levels:
1. **MessageRead** - Per-message read receipts
2. **ConversationRead** - Conversation-level read tracking for unread counts

```
┌─────────────────────┐    ┌──────────────────────────┐    ┌───────────────────────┐    ┌──────────────────────────────┐
│ markMessagesAsRead  │───▶│ Upsert MessageRead       │───▶│ Upsert ConversationRead│───▶│ Broadcast 'messagesRead'     │
│                     │    │ records                  │    │                       │    │ to room                      │
└─────────────────────┘    └──────────────────────────┘    └───────────────────────┘    └──────────────────────────────┘
```

---

## WebRTC Signaling

The WebSocket layer also handles WebRTC signaling for 1-1 video/audio calls:

### Call Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `call:initiate` | Client → Server | Start a call |
| `call:incoming` | Server → Client | Incoming call notification |
| `call:offer` | Both | WebRTC SDP offer |
| `call:answer` | Both | WebRTC SDP answer |
| `call:ice-candidate` | Both | ICE candidate exchange |
| `call:reject` | Client → Server | Reject incoming call |
| `call:end` | Both | End active call |
| `call:cancel` | Client → Server | Cancel outgoing call |

### Call Flow

```
  Caller                        Server                         Callee
    │                              │                              │
    │  call:initiate               │                              │
    │─────────────────────────────▶│                              │
    │                              │  call:incoming               │
    │                              │─────────────────────────────▶│
    │                              │                              │
    │                              │  call:answer (SDP)           │
    │                              │◀─────────────────────────────│
    │  call:answer                 │                              │
    │◀─────────────────────────────│                              │
    │                              │                              │
    │  ╔═══════════════════════════════════════════════════════╗  │
    │  ║          ICE Candidate Exchange Loop                  ║  │
    │  ╟───────────────────────────────────────────────────────╢  │
    │  ║  call:ice-candidate       │                           ║  │
    │  ║─────────────────────────▶│  call:ice-candidate        ║  │
    │  ║                          │─────────────────────────▶  ║  │
    │  ║                          │  call:ice-candidate        ║  │
    │  ║  call:ice-candidate      │◀─────────────────────────  ║  │
    │  ║◀─────────────────────────│                            ║  │
    │  ╚═══════════════════════════════════════════════════════╝  │
    │                              │                              │
    │  ┌──────────────────────────────────────────────────────┐   │
    │  │          P2P Connection Established                  │   │
    │  └──────────────────────────────────────────────────────┘   │
```

---

## Frontend Implementation

### useSocket Hook

The frontend uses a singleton pattern for socket management:

```typescript
// Singleton socket instance
let socketInstance: Socket | null = null;
let currentToken: string | null = null;
let refCount = 0;  // Track component usage

function getSocket(token: string): Socket {
  // Token change = reconnect with new token
  if (socketInstance && currentToken !== token) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  if (!socketInstance) {
    currentToken = token;
    socketInstance = io(SOCKET_URL, {
      query: { token },
      transports: ['websocket'],
    });
  }

  return socketInstance;
}
```

**Key Features:**
- **Singleton Pattern**: Single socket instance shared across components
- **Reference Counting**: Socket only disconnects when no components use it
- **Token Rotation**: Auto-reconnects when token changes
- **Event Bridging**: Socket events are dispatched as DOM CustomEvents for loose coupling

### Usage Example

```typescript
const { joinRoom, sendMessage, emitTyping } = useSocket();

// Join a conversation room
useEffect(() => {
  if (conversationId) {
    joinRoom(conversationId);
  }
}, [conversationId, joinRoom]);

// Send a message
const handleSend = () => {
  sendMessage(conversationId, content);
};
```

---

## Backend Implementation

### ChatGateway Class

```typescript
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // Connection handlers
  async handleConnection(client: Socket) { ... }
  async handleDisconnect(client: Socket) { ... }

  // Message handlers with decorators
  @SubscribeMessage('sendMessage')
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleSendMessage(...) { ... }
}
```

### Room Management

| Room Type | Purpose | Join Trigger |
|-----------|---------|--------------|
| Personal Room (`userId`) | Private notifications | On connection |
| Conversation Room (`conversationId`) | Chat messages | On `joinRoom` event |

---

## Redis User Presence

### Data Structures

```
online_users         → SET of user IDs
user_sockets:{id}    → SET of socket IDs for each user
```

### Service Methods

| Method | Description |
|--------|-------------|
| `setUserOnline(userId, socketId)` | Add socket to user's set, add user to online set |
| `setUserOffline(userId, socketId)` | Remove socket, mark offline only if no remaining sockets |
| `checkUserOnline(userId)` | Check if user is in online set |
| `checkUsersOnline(userIds[])` | Batch check user statuses (uses pipeline) |
| `getOnlineUsers()` | Get all online user IDs |

---

## Security Considerations

1. **JWT Authentication**: Every connection must provide a valid JWT token
2. **User Verification**: Token payload verified against database
3. **Participation Checks**: Users can only send messages to conversations they belong to
4. **Room Authorization**: Users must be participants to join conversation rooms

```typescript
// Authorization check before sending message
const conversation = await this.prismaService.conversation.findUnique({
  where: { id: payload.conversationId },
});

if (!conversation || !conversation.participantIds.includes(userId)) {
  throw new WsException('Unauthorized to send message to this room');
}
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT verification | Required |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `NEXT_PUBLIC_API_URL` | API/WebSocket server URL | `http://localhost:3000` |

### CORS Configuration

```typescript
@WebSocketGateway({ cors: { origin: '*' } })
```

> [!WARNING]
> In production, restrict `cors.origin` to your frontend domain(s).

---

## File References

| File | Description |
|------|-------------|
| [chat.gateway.ts](../backend/src/chat/chat.gateway.ts) | Backend WebSocket gateway |
| [useSocket.ts](../frontend/src/hooks/useSocket.ts) | Frontend socket hook |
| [redis.service.ts](../backend/src/redis/redis.service.ts) | User presence service |
| [create-message.dto.ts](../backend/src/chat/dto/create-message.dto.ts) | Message validation DTO |
