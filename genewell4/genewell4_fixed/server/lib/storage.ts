import fs from "fs";
import path from "path";

// Paths
const PDF_STORAGE_PATH = "/tmp/pdfs";
const ensurePDFDirectory = () => {
  if (!fs.existsSync(PDF_STORAGE_PATH)) {
    fs.mkdirSync(PDF_STORAGE_PATH, { recursive: true });
  }
};

// ==========================================
// IN-MEMORY STORAGE STRUCTURES
// ==========================================

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: string;
  createdAt: string;
}

export interface StoredQuizResponse {
  id: string;
  userId: string;
  quizData: any;
  submittedAt: string;
  analysisId: string;
}

export interface StoredOrder {
  orderId: string;
  userId: string;
  analysisId: string;
  planTier: "free" | "essential" | "premium" | "coaching";
  addOns: string[];
  price: number;
  createdAt: string;
  pdfRecordId?: string;
}

export interface StoredPDFRecord {
  pdfRecordId: string;
  orderId: string;
  analysisId: string;
  userId: string;
  filename: string;
  filepath: string;
  planTier: string;
  addOns: string[];
  userName: string;
  generatedAt: string;
  fileSize: number;
  expiresAt: string; // 30 days from creation
}

// In-memory stores
export const STORAGE = {
  users: new Map<string, StoredUser>(),
  quizResponses: new Map<string, StoredQuizResponse>(),
  orders: new Map<string, StoredOrder>(),
  pdfRecords: new Map<string, StoredPDFRecord>(),
  analysisIdToUserId: new Map<string, string>(), // Quick lookup
  personalizationDataCache: new Map<string, any>(), // Cache for personalization data during purchase flow
} as any;

// ==========================================
// USER MANAGEMENT
// ==========================================

export function createOrGetUser(
  email: string,
  name: string,
  age: number,
  gender: string
): StoredUser {
  ensurePDFDirectory();

  // Check if user exists by email
  let user = Array.from(STORAGE.users.values()).find(
    (u) => u.email === email
  );

  if (user) {
    return user;
  }

  // Create new user
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  user = {
    id: userId,
    name,
    email,
    age,
    gender,
    createdAt: new Date().toISOString(),
  };

  STORAGE.users.set(userId, user);
  return user;
}

export function getUserById(userId: string): StoredUser | undefined {
  return STORAGE.users.get(userId);
}

export function getUserByEmail(email: string): StoredUser | undefined {
  return Array.from(STORAGE.users.values()).find((u) => u.email === email);
}

// ==========================================
// QUIZ RESPONSE MANAGEMENT
// ==========================================

export function storeQuizResponse(
  userId: string,
  quizData: any,
  analysisId: string
): StoredQuizResponse {
  ensurePDFDirectory();

  const quizResponseId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const quizResponse: StoredQuizResponse = {
    id: quizResponseId,
    userId,
    quizData,
    submittedAt: new Date().toISOString(),
    analysisId,
  };

  STORAGE.quizResponses.set(quizResponseId, quizResponse);
  STORAGE.analysisIdToUserId.set(analysisId, userId);

  return quizResponse;
}

export function getQuizResponseByAnalysisId(
  analysisId: string
): StoredQuizResponse | undefined {
  return Array.from(STORAGE.quizResponses.values()).find(
    (q) => q.analysisId === analysisId
  );
}

export function getQuizResponsesByUserId(
  userId: string
): StoredQuizResponse[] {
  return Array.from(STORAGE.quizResponses.values()).filter(
    (q) => q.userId === userId
  );
}

// ==========================================
// ORDER MANAGEMENT
// ==========================================

export function createOrder(
  analysisId: string,
  planTier: "free" | "essential" | "premium" | "coaching",
  addOns: string[] = [],
  price: number = 0
): StoredOrder {
  ensurePDFDirectory();

  const userId = STORAGE.analysisIdToUserId.get(analysisId);
  if (!userId) {
    throw new Error(`Analysis ${analysisId} not found`);
  }

  const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const order: StoredOrder = {
    orderId,
    userId,
    analysisId,
    planTier,
    addOns,
    price,
    createdAt: new Date().toISOString(),
  };

  STORAGE.orders.set(orderId, order);
  return order;
}

export function getOrderById(orderId: string): StoredOrder | undefined {
  return STORAGE.orders.get(orderId);
}

export function getOrdersByUserId(userId: string): StoredOrder[] {
  return Array.from(STORAGE.orders.values()).filter(
    (o) => o.userId === userId
  );
}

export function getOrdersByAnalysisId(analysisId: string): StoredOrder[] {
  return Array.from(STORAGE.orders.values()).filter(
    (o) => o.analysisId === analysisId
  );
}

// ==========================================
// PDF STORAGE & MANAGEMENT
// ==========================================

export function storePDFFile(
  buffer: Buffer,
  filename: string,
  orderId: string,
  analysisId: string,
  planTier: string,
  addOns: string[] = [],
  userName: string
): StoredPDFRecord {
  ensurePDFDirectory();

  const userId = STORAGE.analysisIdToUserId.get(analysisId);
  if (!userId) {
    throw new Error(`Analysis ${analysisId} not found for PDF storage`);
  }

  // Save file to temp storage
  const uniqueFilename = `${Date.now()}_${filename}`;
  const filepath = path.join(PDF_STORAGE_PATH, uniqueFilename);

  fs.writeFileSync(filepath, buffer);

  // Create PDF record
  const pdfRecordId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  const pdfRecord: StoredPDFRecord = {
    pdfRecordId,
    orderId,
    analysisId,
    userId,
    filename: uniqueFilename,
    filepath,
    planTier,
    addOns,
    userName,
    generatedAt: new Date().toISOString(),
    fileSize: buffer.length,
    expiresAt,
  };

  STORAGE.pdfRecords.set(pdfRecordId, pdfRecord);

  // Update order with PDF record ID
  const order = STORAGE.orders.get(orderId);
  if (order) {
    order.pdfRecordId = pdfRecordId;
  }

  return pdfRecord;
}

export function getPDFRecord(
  pdfRecordId: string
): StoredPDFRecord | undefined {
  return STORAGE.pdfRecords.get(pdfRecordId);
}

export function getPDFRecordsByUserId(userId: string): StoredPDFRecord[] {
  return Array.from(STORAGE.pdfRecords.values())
    .filter((p) => p.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
}

export function getPDFRecordsByOrderId(orderId: string): StoredPDFRecord[] {
  return Array.from(STORAGE.pdfRecords.values()).filter(
    (p) => p.orderId === orderId
  );
}

export function getPDFBuffer(pdfRecordId: string): Buffer | null {
  const pdfRecord = STORAGE.pdfRecords.get(pdfRecordId);
  if (!pdfRecord) return null;

  if (!fs.existsSync(pdfRecord.filepath)) {
    return null;
  }

  return fs.readFileSync(pdfRecord.filepath);
}

// ==========================================
// CLEANUP & MAINTENANCE
// ==========================================

export function cleanupExpiredPDFs(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [key, pdfRecord] of STORAGE.pdfRecords.entries()) {
    if (new Date(pdfRecord.expiresAt) < now) {
      // Delete file
      if (fs.existsSync(pdfRecord.filepath)) {
        try {
          fs.unlinkSync(pdfRecord.filepath);
        } catch (err) {
          console.error(`Failed to delete PDF file: ${pdfRecord.filepath}`, err);
        }
      }

      // Remove from storage
      STORAGE.pdfRecords.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Run cleanup every hour
export function startCleanupJob() {
  setInterval(() => {
    const cleaned = cleanupExpiredPDFs();
    if (cleaned > 0) {
      console.log(`[Storage] Cleaned up ${cleaned} expired PDFs`);
    }
  }, 60 * 60 * 1000); // Every hour
}

// ==========================================
// STATISTICS & REPORTING
// ==========================================

export function getStorageStats() {
  return {
    totalUsers: STORAGE.users.size,
    totalQuizResponses: STORAGE.quizResponses.size,
    totalOrders: STORAGE.orders.size,
    totalPDFsGenerated: STORAGE.pdfRecords.size,
    totalStorageUsed: Array.from(STORAGE.pdfRecords.values()).reduce(
      (sum, pdf) => sum + pdf.fileSize,
      0
    ),
    pdfsByTier: {
      free: Array.from(STORAGE.pdfRecords.values()).filter(
        (p) => p.planTier === "free"
      ).length,
      essential: Array.from(STORAGE.pdfRecords.values()).filter(
        (p) => p.planTier === "essential"
      ).length,
      premium: Array.from(STORAGE.pdfRecords.values()).filter(
        (p) => p.planTier === "premium"
      ).length,
      coaching: Array.from(STORAGE.pdfRecords.values()).filter(
        (p) => p.planTier === "coaching"
      ).length,
    },
  };
}

export function getUserDashboard(userId: string) {
  const user = STORAGE.users.get(userId);
  if (!user) return null;

  const quizResponses = getQuizResponsesByUserId(userId);
  const orders = getOrdersByUserId(userId);
  const pdfs = getPDFRecordsByUserId(userId);

  return {
    user,
    quizCount: quizResponses.length,
    orderCount: orders.length,
    pdfCount: pdfs.length,
    lastQuizDate: quizResponses[0]?.submittedAt || null,
    lastOrderDate: orders[0]?.createdAt || null,
    lastPDFDate: pdfs[0]?.generatedAt || null,
    orders: orders.map((o) => ({
      orderId: o.orderId,
      planTier: o.planTier,
      createdAt: o.createdAt,
      pdfRecordId: o.pdfRecordId,
    })),
    pdfs: pdfs.map((p) => ({
      pdfRecordId: p.pdfRecordId,
      orderId: p.orderId,
      filename: p.filename,
      planTier: p.planTier,
      generatedAt: p.generatedAt,
      expiresAt: p.expiresAt,
    })),
  };
}

// ==========================================
// BULK DATA OPERATIONS (FOR TESTING)
// ==========================================

export function clearAllData() {
  STORAGE.users.clear();
  STORAGE.quizResponses.clear();
  STORAGE.orders.clear();
  STORAGE.pdfRecords.clear();
  STORAGE.analysisIdToUserId.clear();

  // Optionally delete all PDFs from filesystem
  if (fs.existsSync(PDF_STORAGE_PATH)) {
    const files = fs.readdirSync(PDF_STORAGE_PATH);
    files.forEach((file) => {
      try {
        fs.unlinkSync(path.join(PDF_STORAGE_PATH, file));
      } catch (err) {
        console.error(`Failed to delete file: ${file}`, err);
      }
    });
  }
}

export function exportStorageSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    stats: getStorageStats(),
    users: Array.from(STORAGE.users.values()),
    orders: Array.from(STORAGE.orders.values()),
    pdfsCount: STORAGE.pdfRecords.size,
  };
}
