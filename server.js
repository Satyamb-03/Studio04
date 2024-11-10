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
    
    const siteTitle = 'Studio04 | Node.js CRUD App with MySQL and Docker';

    /* Home route (requires authentication) */
    app.get('/', (req, res) => {
      if (req.isAuthenticated()) {
        conn.query("SELECT * FROM events ORDER BY e_start_date DESC", (err, result) => {
          res.render('pages/index', {
            siteTitle: siteTitle,
            pageTitle: 'Events list',
            items: result
          });
        });
      } else {
        res.redirect('/signin');
      }
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

    /* Event Routes */
    // (Your event routes stay unchanged)

    app.listen(3000, function(){
      console.log('Server started on port 3000 | 8080 if running on docker...');
    });
  }
});
