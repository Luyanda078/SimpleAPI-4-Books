const http = require('http');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const url = require('url');
require('dotenv').config();

const PORT = 3001;
const API_KEY = process.env.API_KEY;
// console.log(API_KEY)
// Helper functions for data management
const getBooks = () => JSON.parse(fs.readFileSync('./books.json', 'utf8'));
const saveBooks = (books) => fs.writeFileSync('./books.json', JSON.stringify(books, null, 2));

// Authorization middleware
const authorize = (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: Invalid API Key' }));
    return false;
  }
  return true;
};

// Server request handler
const requestHandler = (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;

  if (!authorize(req, res)) return;

  // GET: Retrieve all books or a specific book by ISBN
  if (req.method === 'GET' && pathname === '/books') {
    const books = getBooks();
    const { isbn } = query;

    if (isbn) {
      const book = books.find((b) => b.isbn === isbn);
      if (!book) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Book not found' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(book));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(books));
  }

  // POST: Add a new book
  else if (req.method === 'POST' && pathname === '/books') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { title, author, publisher, publishedDate, isbn } = JSON.parse(body);

      // Validation
      if (!title || !author || !isbn) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Title, Author, and ISBN are required' }));
      }

      const books = getBooks();
      if (books.some((b) => b.isbn === isbn)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Book with this ISBN already exists' }));
      }

      const newBook = { id: uuidv4(), title, author, publisher, publishedDate, isbn };
      books.push(newBook);
      saveBooks(books);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newBook));
    });
  }

  // PUT/PATCH: Update a book by ISBN
  else if (req.method === 'PUT' && pathname.startsWith('/books/')) {
    const isbn = pathname.split('/')[2];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { title, author, publisher, publishedDate } = JSON.parse(body);

      const books = getBooks();
      const bookIndex = books.findIndex((b) => b.isbn === isbn);

      if (bookIndex === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Book not found' }));
      }

      const updatedBook = { ...books[bookIndex], title, author, publisher, publishedDate };
      books[bookIndex] = updatedBook;
      saveBooks(books);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(updatedBook));
    });
  }

  // DELETE: Remove a book by ISBN
  else if (req.method === 'DELETE' && pathname.startsWith('/books/')) {
    const isbn = pathname.split('/')[2];
    const books = getBooks();
    const updatedBooks = books.filter((b) => b.isbn !== isbn);

    if (books.length === updatedBooks.length) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Book not found' }));
    }

    saveBooks(updatedBooks);
    res.writeHead(204);
    res.end();
  }

  // 404 for unhandled routes
  else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
};

// Start the server
const server = http.createServer(requestHandler);
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
