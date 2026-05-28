-- CreateTable
CREATE TABLE "message_translations" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_translations_messageId_languageCode_key" ON "message_translations"("messageId", "languageCode");

-- AddForeignKey
ALTER TABLE "message_translations" ADD CONSTRAINT "message_translations_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
