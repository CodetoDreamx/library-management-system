const elements = {
  connection: document.querySelector('#connection-status'),
  error: document.querySelector('#error-message'),
  books: document.querySelector('#books-table'),
  members: document.querySelector('#members-table'),
  transactions: document.querySelector('#transactions-table'),
  bookSearch: document.querySelector('#book-search'),
  bookDialog: document.querySelector('#book-dialog'),
  memberDialog: document.querySelector('#member-dialog'),
  issueDialog: document.querySelector('#issue-dialog'),
  issueMemberSearch: document.querySelector('#issue-member-search'),
  issueMemberSelect: document.querySelector('#issue-member-select'),
  bookShelf: document.querySelector('#book-shelf'),
  heroIssueButton: document.querySelector('#hero-issue-button'),
};

let availableBooks = [];
let activeMembers = [];
let visibleBooksById = new Map();
let searchTimer;

const shelfColors = ['#ff5e6c', '#ffaaab', '#feb300', '#fff5d7'];

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Request failed (${response.status})`);
  }

  return response.status === 204 ? null : response.json();
}

function setError(message = '') {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function cell(row, value) {
  const td = document.createElement('td');
  td.textContent = value ?? '';
  row.append(td);
  return td;
}

function emptyRow(table, columns, message) {
  const row = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = columns;
  td.textContent = message;
  row.append(td);
  table.replaceChildren(row);
}

function renderShelf(books) {
  const shelf = elements.bookShelf;
  shelf.replaceChildren();

  if (!books || !books.length) {
    const empty = document.createElement('div');
    empty.className = 'book-shelf-empty';
    empty.textContent = 'No books on the shelf yet. Add a new title to start the collection.';
    shelf.append(empty);
    return;
  }

  const featuredBooks = books.slice(0, 10);
  const shelves = [featuredBooks.slice(0, 5), featuredBooks.slice(5)];

  shelves.forEach((tierBooks) => {
    if (!tierBooks.length) {
      return;
    }

    const tier = document.createElement('div');
    tier.className = 'book-shelf-tier';

    tierBooks.forEach((book, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'book-spine';
      button.setAttribute('aria-label', `Filter the catalog to ${book.title}`);
      button.title = `Show ${book.title} in the catalog`;
      button.style.setProperty('--spine-color', shelfColors[(index + tierBooks.length) % shelfColors.length]);
      button.style.setProperty('--spine-height', `${150 + (index % 4) * 18}px`);
      button.textContent = book.title;
      button.addEventListener('click', () => {
        const searchTerm = book.title.trim();
        elements.bookSearch.value = searchTerm;
        elements.bookSearch.focus();
        elements.bookSearch.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#books').scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
      });
      tier.append(button);
    });

    shelf.append(tier);
  });
}

function renderBooks(books) {
  availableBooks = books.filter((book) => book.availableCopies > 0);
  visibleBooksById = new Map(books.map((book) => [book._id, book]));
  renderShelf(books);
  if (!books.length) {
    emptyRow(elements.books, 7, 'No books found.');
    return;
  }

  const rows = books.map((book) => {
    const row = document.createElement('tr');
    cell(row, book.title);
    cell(row, book.author);
    cell(row, book.category);
    cell(row, book.copies);
    cell(row, book.availableCopies);
    const statusCell = cell(row, '');
    const badge = document.createElement('span');
    badge.className = book.availableCopies > 0 ? 'available' : 'issued';
    badge.textContent = book.availableCopies > 0 ? 'In stock' : 'Out of stock';
    statusCell.append(badge);
    const actionCell = document.createElement('td');
    if (book.availableCopies > 0) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'small-button';
      button.dataset.issueBookId = book._id;
      button.textContent = 'Issue';
      actionCell.append(button);
    }
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'small-button secondary-button';
    editButton.dataset.editBookId = book._id;
    editButton.textContent = 'Edit';
    editButton.setAttribute('aria-label', `Edit ${book.title}`);
    actionCell.append(editButton);
    actionCell.classList.add('book-actions');
    row.append(actionCell);
    return row;
  });
  elements.books.replaceChildren(...rows);
}

function renderMembers(members) {
  activeMembers = members.filter((member) => member.status === 'active');
  if (!members.length) {
    emptyRow(elements.members, 4, 'No members registered.');
    return;
  }

  const rows = members.map((member) => {
    const row = document.createElement('tr');
    cell(row, member.name);
    cell(row, member.email);
    cell(row, member.phone);
    const statusCell = cell(row, '');
    const badge = document.createElement('span');
    badge.className = member.status;
    badge.textContent = member.status === 'active' ? 'Active' : 'Inactive';
    statusCell.append(badge);
    return row;
  });
  elements.members.replaceChildren(...rows);
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    emptyRow(elements.transactions, 5, 'No transactions yet.');
    return;
  }

  const rows = transactions.map((transaction) => {
    const row = document.createElement('tr');
    cell(row, transaction.book?.title || 'Book unavailable');
    cell(row, transaction.member?.name || 'Member unavailable');
    cell(row, new Date(transaction.issuedAt).toLocaleDateString());
    const statusCell = cell(row, '');
    const badge = document.createElement('span');
    badge.className = transaction.status;
    badge.textContent = transaction.status === 'returned' ? 'Returned' : 'Issued';
    statusCell.append(badge);
    const actionCell = document.createElement('td');
    if (transaction.status === 'issued') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'small-button';
      button.dataset.returnTransactionId = transaction._id;
      button.textContent = 'Return';
      actionCell.append(button);
    } else {
      actionCell.textContent = '-';
    }
    row.append(actionCell);
    return row;
  });
  elements.transactions.replaceChildren(...rows);
}

function populateIssueOptions() {
  const bookSelect = elements.issueDialog.querySelector('[name="bookId"]');
  bookSelect.replaceChildren();
  for (const book of availableBooks) {
    const option = document.createElement('option');
    option.value = book._id;
    option.textContent = `${book.title} - ${book.author} (${book.availableCopies} available)`;
    bookSelect.append(option);
  }

  elements.issueMemberSearch.value = '';
  renderIssueMemberOptions();
  elements.issueDialog.querySelector('button[type="submit"]').disabled =
    !availableBooks.length || !activeMembers.length;
}

function renderIssueMemberOptions() {
  const memberSelect = elements.issueMemberSelect;
  const selectedMemberId = memberSelect.value;
  const query = elements.issueMemberSearch.value.trim().toLocaleLowerCase();
  const filteredMembers = activeMembers.filter((member) =>
    [member.name, member.email, member.phone]
      .some((value) => value.toLocaleLowerCase().includes(query))
  );

  memberSelect.replaceChildren();
  if (!filteredMembers.length) {
    const option = document.createElement('option');
    option.value = '';
    option.disabled = true;
    option.selected = true;
    option.textContent = activeMembers.length
      ? 'No active members match your search'
      : 'No active members available';
    memberSelect.append(option);
  }

  for (const member of filteredMembers) {
    const option = document.createElement('option');
    option.value = member._id;
    option.textContent = `${member.name} - ${member.email}`;
    memberSelect.append(option);
  }

  if (filteredMembers.some((member) => member._id === selectedMemberId)) {
    memberSelect.value = selectedMemberId;
  }
  elements.issueDialog.querySelector('button[type="submit"]').disabled =
    !availableBooks.length || !filteredMembers.length;
}

async function loadData(search = '') {
  const query = search ? `?q=${encodeURIComponent(search)}` : '';
  const [health, dashboard, books, members, transactions] = await Promise.all([
    request('/api/health'),
    request('/api/dashboard'),
    request(`/api/books${query}`),
    request('/api/members'),
    request('/api/transactions'),
  ]);

  elements.connection.textContent = health.status === 'ok'
    ? 'Connected to the library database'
    : 'Database connection unavailable';
  elements.connection.classList.toggle('connected', health.status === 'ok');
  document.querySelector('#total-books').textContent = dashboard.totalBooks;
  document.querySelector('#total-members').textContent = dashboard.totalMembers;
  document.querySelector('#issued-books').textContent = dashboard.issuedBooks;
  document.querySelector('#available-books').textContent = dashboard.availableBooks;
  renderBooks(books);
  renderMembers(members);
  renderTransactions(transactions);
  populateIssueOptions();
  setError();
}

async function perform(action) {
  setError();
  try {
    await action();
    await loadData(elements.bookSearch.value.trim());
  } catch (error) {
    setError(error.message);
  }
}

document.querySelector('#add-book-button').addEventListener('click', () => {
  const form = document.querySelector('#book-form');
  form.reset();
  delete form.dataset.bookId;
  form.elements.copies.min = '1';
  form.querySelector('#copies-help').textContent =
    'Total stock, including any copies currently issued.';
  form.querySelector('h2').textContent = 'Add a book';
  form.querySelector('button[type="submit"]').textContent = 'Save book';
  elements.bookDialog.showModal();
});

function openEditBook(bookId) {
  const book = visibleBooksById.get(bookId);
  if (!book) {
    setError('This book is no longer in the current list. Refresh and try again.');
    return;
  }

  const form = document.querySelector('#book-form');
  form.elements.title.value = book.title;
  form.elements.author.value = book.author;
  form.elements.category.value = book.category;
  form.elements.copies.value = book.copies;
  form.elements.copies.min = String(Math.max(1, book.issuedCopies));
  form.querySelector('#copies-help').textContent =
    `${book.issuedCopies} ${book.issuedCopies === 1 ? 'copy is' : 'copies are'} currently issued.`;
  form.dataset.bookId = book._id;
  form.querySelector('h2').textContent = 'Edit book';
  form.querySelector('button[type="submit"]').textContent = 'Save changes';
  setError();
  elements.bookDialog.showModal();
}

document.querySelector('#add-member-button').addEventListener('click', () => {
  document.querySelector('#member-form').reset();
  elements.memberDialog.showModal();
});

document.querySelector('#issue-book-button').addEventListener('click', () => {
  populateIssueOptions();
  if (!availableBooks.length || !activeMembers.length) {
    setError('Add an available book and an active member before issuing a book.');
    return;
  }
  setError();
  elements.issueDialog.showModal();
});

elements.heroIssueButton.addEventListener('click', () => {
  document.querySelector('#issue-book-button').click();
});

elements.issueMemberSearch.addEventListener('input', renderIssueMemberOptions);

document.querySelector('#book-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const bookId = form.dataset.bookId;
  perform(async () => {
    await request(
      bookId ? `/api/books/${bookId}` : '/api/books',
      {
        method: bookId ? 'PATCH' : 'POST',
        body: JSON.stringify(data),
      }
    );
    elements.bookDialog.close();
    delete form.dataset.bookId;
  });
});

document.querySelector('#member-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  perform(async () => {
    await request('/api/members', { method: 'POST', body: JSON.stringify(data) });
    elements.memberDialog.close();
  });
});

document.querySelector('#issue-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  perform(async () => {
    await request('/api/transactions', { method: 'POST', body: JSON.stringify(data) });
    elements.issueDialog.close();
  });
});

for (const button of document.querySelectorAll('[data-close-dialog]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.returnTransactionId) {
    perform(() => request(
      `/api/transactions/${button.dataset.returnTransactionId}/return`,
      { method: 'POST' }
    ));
  } else if (button.dataset.issueBookId) {
    populateIssueOptions();
    const selector = elements.issueDialog.querySelector('[name="bookId"]');
    selector.value = button.dataset.issueBookId;
    if (activeMembers.length) {
      elements.issueDialog.showModal();
    } else {
      setError('Add an active member before issuing a book.');
    }
  } else if (button.dataset.editBookId) {
    openEditBook(button.dataset.editBookId);
  }
});

elements.bookSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const query = elements.bookSearch.value.trim();
    request(`/api/books?q=${encodeURIComponent(query)}`)
      .then((books) => renderBooks(books))
      .catch((error) => setError(error.message));
  }, 250);
});

loadData().catch((error) => {
  elements.connection.textContent = 'Unable to connect to the library database';
  elements.connection.classList.remove('connected');
  setError(error.message);
});
