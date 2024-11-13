const express = require('express');
const http = require('http');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const dateFormat = require('dateformat');
const session = require('express-session');
const passport = require('./passport');  // Import passport configuration
const bcrypt = require('bcryptjs');
const app = express();

/* Middleware setup */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');

app.use(session({
  secret: 'your-secret-key', // replace with a stronger secret
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const conn = mysql.createConnection({
  host: 'mysql-dev',
  user: 'root',
  password: 'root',
  database: 'node_crud'
});

conn.connect(function(err) {
  if (err) {
    console.log('Cannot connect with database');
  } else {
    // Create user table if not exists
    conn.query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('attendee', 'admin') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create events table if not exists
    conn.query('CREATE TABLE IF NOT EXISTS events( e_id INT NOT NULL AUTO_INCREMENT, e_name VARCHAR(100) NOT NULL, e_start_date DATE NOT NULL, e_end_date DATE NOT NULL, e_added_date DATE, e_desc TEXT, e_location VARCHAR(200), PRIMARY KEY(e_id))');

    const siteTitle = 'Studio04 | Node.js CRUD App with MySQL and Docker';

    /* Home route - No authentication required */
    app.get('/', (req, res) => {
      conn.query("SELECT * FROM events ORDER BY e_start_date DESC", (err, result) => {
        res.render('pages/index', {
          siteTitle: siteTitle,
          pageTitle: 'Events list',
          items: result
        });
      });
    });

    /* Show add event page */
    app.get('/event/add', (req, res) => {
      res.render('pages/add-event', {
        siteTitle: siteTitle,
        pageTitle: 'Add new event',
        items: ''
      });
    });

    /* Post event to database */
    app.post('/event/add', (req, res) => {
      var query = 'INSERT INTO events (e_name, e_start_date, e_end_date, e_added_date, e_desc, e_location) VALUES ('; 
      query += ' "' + req.body.e_name + '", ';
      query += ' "' + dateFormat(req.body.e_start_date, "yyyy-mm-dd") + '", ';
      query += ' "' + dateFormat(req.body.e_end_date, "yyyy-mm-dd") + '", ';
      query += ' "' + dateFormat(new Date(), "yyyy-mm-dd") + '", ';
      query += ' "' + req.body.e_desc + '", ';
      query += ' "' + req.body.e_location + '"';
      query += ' )';

      conn.query(query, function(err, result) {
        if (err) {
          console.error('Error inserting event:', err);
          return res.status(500).send('Error adding event');
        }
        res.redirect('/');
      });
    });

    /* Event edit page */
    app.get('/event/edit/:id', (req, res) => {
      // Fetch the event by ID
      conn.query('SELECT * FROM events WHERE e_id = "' + req.params.id + '"', function(err, result) {
        if (err || result.length === 0) {
          return res.status(404).send('Event not found');
        }

        // Format the dates
        result[0].e_start_date = dateFormat(result[0].e_start_date, "yyyy-mm-dd");
        result[0].e_end_date = dateFormat(result[0].e_end_date, "yyyy-mm-dd");

        res.render('pages/edit-event', {
          siteTitle: siteTitle,
          pageTitle: 'Edit event: ' + result[0].e_name,
          item: result[0]
        });
      });
    });

    // Edit event
    app.post('/event/edit', (req, res) => {
      const query = 'UPDATE events SET';
      query += ' e_name = "' + req.body.e_name + '", ';
      query += ' e_start_date = "' + dateFormat(req.body.e_start_date, "yyyy-mm-dd") + '", ';
      query += ' e_end_date = "' + dateFormat(req.body.e_end_date, "yyyy-mm-dd") + '", ';
      query += ' e_desc = "' + req.body.e_desc + '", ';
      query += ' e_location = "' + req.body.e_location + '"';
      query += ' WHERE e_id = ' + req.body.e_id;

      conn.query(query, function(err, result) {
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

    /* Event delete */
    app.get('/event/delete/:id', (req, res) => {
      conn.query('DELETE FROM events WHERE e_id = "' + req.params.id + '"', function(err, result) {
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

    /* Sign-up page */
    app.get('/signup', (req, res) => {
      res.render('pages/signup', { siteTitle: siteTitle, pageTitle: 'Sign Up' });
    });

    /* Post sign-up */
    app.post('/signup', (req, res) => {
      const { username, password, role } = req.body;

      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) return res.status(500).send('Error hashing password');

        const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
        conn.query(query, [username, hashedPassword, role], (err, result) => {
          if (err) return res.status(500).send('Error creating user');
          res.redirect('/signin');
        });
      });
    });

    /* Sign-in page */
    app.get('/signin', (req, res) => {
      if (req.isAuthenticated()) {
        return res.redirect('/'); // Redirect to home page if already authenticated
      }
      res.render('pages/signin', { siteTitle: siteTitle, pageTitle: 'Sign In' });
    });

    /* Post sign-in */
    app.post('/signin', passport.authenticate('local', {
      successRedirect: '/',
      failureRedirect: '/signin',
      failureFlash: true
    }));

    /* Sign-out route */
    app.get('/signout', (req, res) => {
      req.logout((err) => {
        if (err) return res.status(500).send('Error logging out');
        res.redirect('/signin');
      });
    });

    app.listen(3000, function() {
      console.log('Server started on port 3000 | 8080 if running on docker...');
    });
  }
});
