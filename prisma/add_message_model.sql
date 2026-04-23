-- Add Message model to schema.prisma
-- Add this at the end of the schema.prisma file

model Message {
  id        String   @id @default(uuid())
  content   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Sender relation
  senderId String
  sender   User   @relation("SentMessages", fields: [senderId], references: [id], onDelete: Cascade)

  // Receiver relation
  receiverId String
  receiver   User   @relation("ReceivedMessages", fields: [receiverId], references: [id], onDelete: Cascade)

  // Optional: related to a dog, reservation, etc.
  dogId String?

  @@map("messages")
}
