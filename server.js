const express = require('express');
const mongoose = require('mongoose');
const path = require('node:path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10kb' }));

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    copies: { type: Number, required: true, min: 1, default: 1 },
    issuedCopies: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['available', 'issued'],
      default: 'available',
    },
  },
  { timestamps: true }
);

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

const transactionSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    status: {
      type: String,
      enum: ['issued', 'returned'],
      default: 'issued',
    },
    issuedAt: { type: Date, default: Date.now },
    returnedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Book = mongoose.model('Book', bookSchema);
const Member = mongoose.model('Member', memberSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter(
      (field) =>
        typeof req.body[field] !== 'string' || req.body[field].trim() === ''
    );

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Required non-empty fields: ${missing.join(', ')}`,
      });
    }

    next();
  };
}

function bookInventory(book) {
  const value = book.toObject ? book.toObject() : book;
  const copies = Number.isInteger(value.copies) && value.copies > 0 ? value.copies : 1;
  const issuedCopies = Number.isInteger(value.issuedCopies) && value.issuedCopies >= 0
    ? value.issuedCopies
    : 0;
  const availableCopies = Math.max(0, copies - issuedCopies);

  return {
    ...value,
    copies,
    issuedCopies,
    availableCopies,
    status: availableCopies > 0 ? 'available' : 'issued',
  };
}

async function changeIssuedCopies(bookId, amount) {
  const condition = amount > 0
    ? { $lt: ['$issuedCopies', '$copies'] }
    : { $gt: ['$issuedCopies', 0] };

  return Book.findOneAndUpdate(
    { _id: bookId, $expr: condition },
    [
      { $set: { issuedCopies: { $add: ['$issuedCopies', amount] } } },
      {
        $set: {
          status: {
            $cond: [{ $gte: ['$issuedCopies', '$copies'] }, 'issued', 'available'],
          },
        },
      },
    ],
    { new: true, updatePipeline: true }
  );
}

function pdfText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/[\\()]/g, '\\$&');
}

function createStockReportPdf(books) {
  const generatedAt = new Date().toLocaleString('en-US');
  const availableTotal = books.reduce((total, book) => total + book.availableCopies, 0);
  const linesPerPage = 42;
  const pages = [];

  for (let start = 0; start < books.length || start === 0; start += linesPerPage) {
    const lines = [
      { text: 'Available Library Stock', x: 50, y: 755, size: 18 },
      { text: `Generated: ${generatedAt}`, x: 50, y: 735, size: 9 },
      { text: `Titles in stock: ${books.length}    Available copies: ${availableTotal}`, x: 50, y: 716, size: 10 },
      { text: 'TITLE', x: 50, y: 687, size: 9 },
      { text: 'AUTHOR', x: 255, y: 687, size: 9 },
      { text: 'CATEGORY', x: 395, y: 687, size: 9 },
      { text: 'TOTAL', x: 520, y: 687, size: 9 },
      { text: 'AVAILABLE', x: 565, y: 687, size: 9 },
    ];

    books.slice(start, start + linesPerPage).forEach((book, index) => {
      const y = 667 - index * 14;
      lines.push(
        { text: book.title.slice(0, 32), x: 50, y, size: 9 },
        { text: book.author.slice(0, 22), x: 255, y, size: 9 },
        { text: book.category.slice(0, 16), x: 395, y, size: 9 },
        { text: String(book.copies), x: 525, y, size: 9 },
        { text: String(book.availableCopies), x: 580, y, size: 9 }
      );
    });

    if (books.length === 0) {
      lines.push({ text: 'No books currently have available stock.', x: 50, y: 667, size: 10 });
    }

    lines.push({ text: `Page ${pages.length + 1}`, x: 550, y: 30, size: 8 });
    pages.push(lines);
  }

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  pages.forEach((lines, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const content = lines.map((line) =>
      `BT /F1 ${line.size} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${pdfText(line.text)}) Tj ET`
    ).join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/dashboard', async (req, res) => {
  const [inventory, totalMembers] = await Promise.all([
    Book.aggregate([
      {
        $group: {
          _id: null,
          totalCopies: { $sum: { $ifNull: ['$copies', 1] } },
          issuedCopies: { $sum: { $ifNull: ['$issuedCopies', 0] } },
        },
      },
    ]),
    Member.countDocuments(),
  ]);
  const totalCopies = inventory[0]?.totalCopies || 0;
  const issuedCopies = inventory[0]?.issuedCopies || 0;

  res.json({
    totalBooks: totalCopies,
    totalMembers,
    issuedBooks: issuedCopies,
    availableBooks: Math.max(0, totalCopies - issuedCopies),
  });
});

app.get('/api/books', async (req, res) => {
  const filter = {};
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const search = new RegExp(escapeRegex(req.query.q.trim()), 'i');
    filter.$or = [
      { title: search },
      { author: search },
      { category: search },
    ];
  }

  const books = await Book.find(filter).sort({ createdAt: -1 });
  res.json(books.map(bookInventory));
});

app.post(
  '/api/books',
  requireFields(['title', 'author', 'category']),
  async (req, res) => {
    const copies = Number(req.body.copies);
    if (!Number.isSafeInteger(copies) || copies < 1) {
      return res.status(400).json({ error: 'copies must be a positive whole number' });
    }

    const book = await Book.create({
      title: req.body.title,
      author: req.body.author,
      category: req.body.category,
      copies,
    });
    res.status(201).json(bookInventory(book));
  }
);

app.patch('/api/books/:id', async (req, res) => {
  const allowedFields = ['title', 'author', 'category', 'copies'];
  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) {
      if (field === 'copies') {
        const copies = Number(req.body.copies);
        if (!Number.isSafeInteger(copies) || copies < 1) {
          return res.status(400).json({ error: 'copies must be a positive whole number' });
        }
        updates.copies = copies;
        continue;
      }
      if (typeof req.body[field] !== 'string' || !req.body[field].trim()) {
        return res.status(400).json({ error: `${field} must be a non-empty string` });
      }
      updates[field] = req.body[field].trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Provide at least one book field to update' });
  }

  const changesCopies = Object.hasOwn(updates, 'copies');
  const book = changesCopies
    ? await Book.findOneAndUpdate(
      { _id: req.params.id, $expr: { $lte: ['$issuedCopies', updates.copies] } },
      [
        { $set: updates },
        {
          $set: {
            status: {
              $cond: [{ $gte: ['$issuedCopies', '$copies'] }, 'issued', 'available'],
            },
          },
        },
      ],
      { new: true, updatePipeline: true }
    )
    : await Book.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
  if (!book) {
    const existingBook = await Book.findById(req.params.id).select('_id');
    if (!existingBook) {
      return res.status(404).json({ error: 'Book not found' });
    }
    return res.status(409).json({
      error: 'Total copies cannot be less than the number of copies currently issued',
    });
  }
  res.json(bookInventory(book));
});

app.delete('/api/books/:id', async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const hasTransactionHistory = await Transaction.exists({ book: book._id });
  if (hasTransactionHistory) {
    return res.status(409).json({ error: 'Books with transaction history cannot be deleted' });
  }

  await book.deleteOne();
  res.status(204).end();
});

app.get('/api/members', async (req, res) => {
  res.json(await Member.find().sort({ createdAt: -1 }));
});

app.post(
  '/api/members',
  requireFields(['name', 'email', 'phone']),
  async (req, res) => {
    const member = await Member.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
    });
    res.status(201).json(member);
  }
);

app.patch('/api/members/:id', async (req, res) => {
  const allowedFields = ['name', 'email', 'phone', 'status'];
  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) {
      const value = req.body[field];
      if (typeof value !== 'string' || !value.trim()) {
        return res.status(400).json({ error: `${field} must be a non-empty string` });
      }
      updates[field] = value.trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Provide at least one member field to update' });
  }

  const member = await Member.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }
  res.json(member);
});

app.delete('/api/members/:id', async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const hasTransactionHistory = await Transaction.exists({ member: member._id });
  if (hasTransactionHistory) {
    return res.status(409).json({ error: 'Members with transaction history cannot be deleted' });
  }

  await member.deleteOne();
  res.status(204).end();
});

app.get('/api/transactions', async (req, res) => {
  const transactions = await Transaction.find()
    .populate('book', 'title author category')
    .populate('member', 'name email')
    .sort({ issuedAt: -1 });
  res.json(transactions);
});

app.post(
  '/api/transactions',
  requireFields(['bookId', 'memberId']),
  async (req, res) => {
    const { bookId, memberId } = req.body;
    if (
      !mongoose.isValidObjectId(bookId) ||
      !mongoose.isValidObjectId(memberId)
    ) {
      return res.status(400).json({ error: 'bookId and memberId must be valid IDs' });
    }

    const [book, member] = await Promise.all([
      Book.findById(bookId),
      Member.findById(memberId),
    ]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (member.status !== 'active') {
      return res.status(409).json({ error: 'Only active members can borrow books' });
    }

    const availableBook = await changeIssuedCopies(bookId, 1);
    if (!availableBook) {
      return res.status(409).json({ error: 'No copies of this book are currently available' });
    }

    let transaction;
    try {
      transaction = await Transaction.create({ book: bookId, member: memberId });
    } catch (error) {
      await changeIssuedCopies(bookId, -1);
      throw error;
    }

    await transaction.populate([
      { path: 'book', select: 'title author category' },
      { path: 'member', select: 'name email' },
    ]);
    res.status(201).json(transaction);
  }
);

app.post('/api/transactions/:id/return', async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  if (transaction.status !== 'issued') {
    return res.status(409).json({ error: 'This transaction has already been returned' });
  }

  const availableBook = await changeIssuedCopies(transaction.book, -1);
  if (!availableBook) {
    return res.status(409).json({ error: 'No issued copy is available to return' });
  }

  const returnedTransaction = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: 'issued' },
    { $set: { status: 'returned', returnedAt: new Date() } },
    { new: true }
  );
  if (!returnedTransaction) {
    await changeIssuedCopies(transaction.book, 1);
    return res.status(409).json({ error: 'This transaction has already been returned' });
  }

  await returnedTransaction.populate([
    { path: 'book', select: 'title author category' },
    { path: 'member', select: 'name email' },
  ]);
  res.json(returnedTransaction);
});

app.get('/api/reports/available-stock.pdf', async (req, res) => {
  const books = (await Book.find().sort({ title: 1 })).map(bookInventory);
  const inStock = books.filter((book) => book.availableCopies > 0);
  const pdf = createStockReportPdf(inStock);

  res.type('application/pdf');
  res.set('Content-Disposition', 'attachment; filename="available-library-stock.pdf"');
  res.send(pdf);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof mongoose.Error.ValidationError ||
      error instanceof mongoose.Error.CastError ||
      error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: 'A member with this email already exists' });
  }

  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/library_management';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  const issuedCounts = await Transaction.aggregate([
    { $match: { status: 'issued' } },
    { $group: { _id: '$book', count: { $sum: 1 } } },
  ]);
  const issuedByBook = new Map(issuedCounts.map(({ _id, count }) => [String(_id), count]));
  const books = await Book.find().select('_id copies').lean();
  if (books.length) {
    await Book.bulkWrite(books.map((book) => {
      const copies = Number.isSafeInteger(book.copies) && book.copies > 0 ? book.copies : 1;
      const issuedCopies = issuedByBook.get(String(book._id)) || 0;
      return {
        updateOne: {
          filter: { _id: book._id },
          update: {
            $set: {
              copies,
              issuedCopies,
              status: issuedCopies >= copies ? 'issued' : 'available',
            },
          },
        },
      };
    }));
  }
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Library Management API listening at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`Unable to connect to MongoDB: ${error.message}`);
    console.error('Check that MongoDB is running locally or set MONGODB_URI to a valid connection string.');
    process.exitCode = 1;
  });
}

module.exports = app;
