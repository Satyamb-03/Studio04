const express = require('express');
const http = require('http');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const dateFormat = require('dateformat');
const session = require('express-session');
const passport = require('./passport'); // Import passport configuration
const bcrypt = require('bcryptjs');
const app = express();

/* Middleware setup */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');

app.use(
  session({
    secret: 'your-secret-key', // Replace with a stronger secret
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* Middleware to make user globally available in views */
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

/* MySQL connection */
const conn = mysql.createConnection({
  host: 'mysql-dev',
  user: 'root',
  password: 'root',
  database: 'node_crud',
});

conn.connect((err) => {
  if (err) {
    console.error('Cannot connect with the database:', err);
    process.exit(1); // Exit the process if the connection fails
  }

  console.log('Connected to the MySQL database');

  /* Create tables if not exist */
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('attendee', 'admin') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
  conn.query(createUsersTable);

  const createEventsTable = `
    CREATE TABLE IF NOT EXISTS events (
      e_id INT AUTO_INCREMENT PRIMARY KEY,
      e_name VARCHAR(100) NOT NULL,
      e_start_date DATE NOT NULL,
      e_end_date DATE NOT NULL,
      e_added_date DATE,
      e_desc TEXT,
      e_location VARCHAR(200)
    )`;
  conn.query(createEventsTable);

  const createJoinTable = `
    CREATE TABLE IF NOT EXISTS user_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      event_id INT NOT NULL,
      username VARCHAR(255) NOT NULL,
      message VARCHAR(200) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (event_id) REFERENCES events(e_id),
      UNIQUE (user_id, event_id) -- Ensure unique user-event pairs
    )`;
  conn.query(createJoinTable)

  /* Site title */
  const siteTitle = 'Studio04 | Node.js CRUD App with MySQL and Docker';

  app.get('/', (req, res) => {
    conn.query('SELECT * FROM events ORDER BY e_start_date DESC', (err, result) => {
      if (err) {
        console.error('Error fetching events:', err);
        return res.status(500).send('Error fetching events');
      }
  
      // Format dates before sending them to the view
      result.forEach(event => {
        event.e_start_date = dateFormat(event.e_start_date, 'yyyy-mm-dd');
        event.e_end_date = dateFormat(event.e_end_date, 'yyyy-mm-dd');
      });
  
      res.render('pages/index', {
        siteTitle,
        pageTitle: 'Events list',
        items: result,
      });
    });
  });
  

  app.get('/event/add', (req, res) => {
    res.render('pages/add-event', {
      siteTitle,
      pageTitle: 'Add new event',
      item: {}  // Add an empty object to prevent undefined errors in the template
    });
  });
  

  app.post('/event/add', (req, res) => {
    const query = `
      INSERT INTO events (e_name, e_start_date, e_end_date, e_start_time, e_end_time, e_added_date, e_desc, e_location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      req.body.e_name,
      dateFormat(req.body.e_start_date, 'yyyy-mm-dd'),
      dateFormat(req.body.e_end_date, 'yyyy-mm-dd'),
      req.body.e_start_time,
      req.body.e_end_time,
      dateFormat(new Date(), 'yyyy-mm-dd'),
      req.body.e_desc,
      req.body.e_location,
    ];
  
    conn.query(query, values, (err) => {
      if (err) {
        console.error('Error inserting event:', err);
        return res.status(500).send('Error adding event');
      }
      res.redirect('/');
    });
  });
  

  app.get('/event/edit/:id', (req, res) => {
    const query = 'SELECT * FROM events WHERE e_id = ?';
    conn.query(query, [req.params.id], (err, result) => {
      if (err || result.length === 0) {
        return res.status(404).send('Event not found');
      }

      const event = result[0];
      event.e_start_date = dateFormat(event.e_start_date, 'yyyy-mm-dd');
      event.e_end_date = dateFormat(event.e_end_date, 'yyyy-mm-dd');

      res.render('pages/edit-event', {
        siteTitle,
        pageTitle: `Edit event: ${event.e_name}`,
        item: event,
      });
    });
  });

  app.post('/event/edit', (req, res) => {
    const query = `
      UPDATE events SET
      e_name = ?, e_start_date = ?, e_end_date = ?, e_start_time = ?, e_end_time = ?, e_desc = ?, e_location = ?
      WHERE e_id = ?`;
    const values = [
      req.body.e_name,
      dateFormat(req.body.e_start_date, 'yyyy-mm-dd'),
      dateFormat(req.body.e_end_date, 'yyyy-mm-dd'),
      req.body.e_start_time,
      req.body.e_end_time,
      req.body.e_desc,
      req.body.e_location,
      req.body.e_id,
    ];
  
    conn.query(query, values, (err, result) => {
      if (err) {
        console.error('Error updating event:', err);
        return res.status(500).send('Error updating event');
      }
  
      if (result.affectedRows) {
        res.redirect('/');
      } else {
        res.status(404).send('Event not found');
      }
    });
  });
  

  app.get('/event/delete/:id', (req, res) => {
    const query = 'DELETE FROM events WHERE e_id = ?';
    conn.query(query, [req.params.id], (err, result) => {
      if (err) {
        console.error('Error deleting event:', err);
        return res.status(500).send('Error deleting event');
      }

      if (result.affectedRows) {
        res.redirect('/');
      } else {
        res.status(404).send('Event not found');
      }
    });
  });

  app.get('/signup', (req, res) => {
    res.render('pages/signup', { siteTitle, pageTitle: 'Sign Up' });
  });

  app.post('/signup', (req, res) => {
    const { username, password, role } = req.body;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).send('Error hashing password');

      const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
      conn.query(query, [username, hashedPassword, role], (err) => {
        if (err) return res.status(500).send('Error creating user');
        res.redirect('/signin');
      });
    });
  });

  app.get('/signin', (req, res) => {
    if (req.isAuthenticated()) {
      return res.redirect('/');
    }
    res.render('pages/signin', { siteTitle, pageTitle: 'Sign In' });
  });

  app.post('/signin', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.redirect('/signin'); // Redirect to sign-in page if authentication fails
  
      req.logIn(user, (err) => {
        if (err) return next(err);
  
        // Role-based redirection
        if (user.role === 'attendee') {
          return res.redirect('/userdashboard');
        }
        return res.redirect('/');
      });
    })(req, res, next);
  });
 
  app.get('/admindashboard', (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.redirect('/signin'); // Redirect to sign in page if not authenticated or not an admin
    }

    // Fetch events
    conn.query('SELECT * FROM events ORDER BY e_start_date DESC', (err, events) => {
      if (err) {
        console.error('Error fetching events:', err);
        return res.status(500).send('Error fetching events');
      }

      // Fetch users
      conn.query('SELECT * FROM users ORDER BY created_at DESC', (err, users) => {
        if (err) {
          console.error('Error fetching users:', err);
          return res.status(500).send('Error fetching users');
        }

        events.forEach(event => {
          event.e_start_date = dateFormat(event.e_start_date, 'yyyy-mm-dd');
          event.e_end_date = dateFormat(event.e_end_date, 'yyyy-mm-dd');
        });

        res.render('pages/admindashboard', {
          siteTitle,
          pageTitle: 'Admin Dashboard',
          events: events,
          users: users,
        });
      });
    });
  });
  
  app.get('/logout', (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).send('Error logging out');
      res.redirect('/signin');
    });
  });

  app.get('/userdashboard', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.redirect('/signin'); // Redirect to sign in page if not authenticated
    }
  
    const userId = req.user.id; // Assuming you're using user authentication with req.user
  
    // You can fetch user-specific events if needed
    conn.query('SELECT * FROM events ORDER BY e_start_date DESC', (err, result) => {
      if (err) {
        console.error('Error fetching events:', err);
        return res.status(500).send('Error fetching events');
      }
  
      result.forEach(event => {
        event.e_start_date = dateFormat(event.e_start_date, 'yyyy-mm-dd');
        event.e_end_date = dateFormat(event.e_end_date, 'yyyy-mm-dd');
      });
  
      res.render('pages/userdashboard', {
        siteTitle,
        pageTitle: 'User Dashboard',
        items: result, // Pass events or any other data you want to show
      });
    });
  });

  // Add this route in your server.js file
app.get('/user/delete/:id', (req, res) => {
  const userId = req.params.id;

  const query = 'DELETE FROM users WHERE id = ?';
  conn.query(query, [userId], (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).send('Error deleting user');
    }

    if (result.affectedRows) {
      res.redirect('/admindashboard'); // Redirect back to admin dashboard
    } else {
      res.status(404).send('User  not found');
    }
  });
});
  
  //Get events attended by the user
  app.get('/user/events/:userId', (req, res) => {
    const userId = req.params.userId;
  
    const query = `
      SELECT e.* 
      FROM events e
      JOIN user_events ue ON e.e_id = ue.event_id
      WHERE ue.user_id = ?`;
    
    conn.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Error fetching user events:', err);
        return res.status(500).send('Error fetching events');
      }
  
      results.forEach(event => {
        event.e_start_date = dateFormat(event.e_start_date, 'yyyy-mm-dd');
        event.e_end_date = dateFormat(event.e_end_date, 'yyyy-mm-dd');
      });
  
      res.render('pages/user-events', {
        siteTitle,
        pageTitle: 'Your Events',
        items: results,
      });
    });
  });
  
  //Get users attending an event
  app.get('/event/attendees/:eventId', (req, res) => {
    const eventId = req.params.eventId;
  
    const query = `
      SELECT u.username 
      FROM users u
      JOIN user_events ue ON u.id = ue.user_id
      WHERE ue.event_id = ?`;
    
    conn.query(query, [eventId], (err, results) => {
      if (err) {
        console.error('Error fetching event attendees:', err);
        return res.status(500).send('Error fetching attendees');
      }
  
      res.render('pages/event-attendees', {
        siteTitle,
        pageTitle: 'Event Attendees',
        attendees: results,
      });
    });
  });
  
  app.post('/event/join/:id', (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id; // Assuming user is authenticated
    const username = req.user.username;
    const message = req.body.message;
  
    const query = `
      INSERT INTO user_events (user_id, event_id, username, message)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE message = VALUES(message)`; // Update if the user already joined
  
    const values = [userId, eventId, username, message];
  
    conn.query(query, values, (err, result) => {
      if (err) {
        console.error('Error saving join message:', err);
        return res.status(500).json({ message: 'Error saving message', error: err });
      }
  
      // Log the result for debugging
      console.log('Join result:', result);
  
      // Send a success response if the data is saved
      res.status(200).json({
        message: 'Successfully joined the event',
        eventId: eventId,
        username: username,
        userMessage: message,
      });
    });
  });




  app.get('/user/joined-events', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.redirect('/signin'); // Redirect to sign in page if not authenticated
    }
  
    const userId = req.user.id;
  
    const query = `
      SELECT e.*, ue.message 
      FROM events e
      JOIN user_events ue ON e.e_id = ue.event_id
      WHERE ue.user_id = ?`;
  
    conn.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Error fetching joined events:', err);
        return res.status(500).send('Error fetching events');
      }
  
      results.forEach(event => {
        event.e_start_date = dateFormat(event.e_start_date, ' yyyy-mm-dd');
        event.e_end_date = dateFormat(event.e_end_date, 'yyyy-mm-dd');
      });
  
      res.render('pages/joined-events', {
        siteTitle,
        pageTitle: 'Your Joined Events',
        items: results,
      });
    });
  });
  
  
  

  app.listen(3000, () => {
    console.log('Server started on port 3000 | 8080 if running on Docker...');
  });
});


