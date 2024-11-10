const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

// MySQL connection (adjust if needed)
const conn = mysql.createConnection({
  host: 'mysql-dev',
  user: 'root',
  password: 'root',
  database: 'node_crud'
});

// Serialize and deserialize user for session management
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  conn.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
    if (err) return done(err);
    done(null, rows[0]);
  });
});

// Local strategy for logging in users
passport.use(new LocalStrategy(
  (username, password, done) => {
    conn.query('SELECT * FROM users WHERE username = ?', [username], (err, rows) => {
      if (err) return done(err);
      if (!rows.length) return done(null, false, { message: 'Invalid credentials.' });

      const user = rows[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return done(err);
        if (!isMatch) return done(null, false, { message: 'Invalid credentials.' });
        return done(null, user);
      });
    });
  }
));

module.exports = passport;
