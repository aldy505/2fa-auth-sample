const express = require('express')
const cors = require('cors')
const { generate } = require('generate-passphrase')
const { hash, argon2id, verify } = require('argon2')
const { db, initializeDatabase } = require('./database')
const { createTransport } = require('nodemailer')

const app = express()

/**
 * Cross-Origin Resource Sharing (CORS) is an HTTP-header based mechanism that
 * allows a server to indicate any other origins (domain, scheme, or port) than
 * its own from which a browser should permit loading of resources. 
 * 
 * Read more about it here: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 * The CORS middleware we're using: https://github.com/expressjs/cors
 */
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/**
 * Cross-Site Request Forgery (CSRF) is an attack that forces an end user to execute
 * unwanted actions on a web application in which they’re currently authenticated.
 * With a little help of social engineering (such as sending a link via email or chat),
 * an attacker may trick the users of a web application into executing actions of
 * the attacker’s choosing.
 * 
 * Read more about it here: https://owasp.org/www-community/attacks/csrf
 * The CSRF middleware you should be using: https://github.com/expressjs/csurf
 * 
 * I'm not using that because of this project simplicity.
 */
function csrfProtection(req, res, next) {
  const csrf = req.body['_csrf'] || req.header('csrf-token') || req.header('xsrf-token')
  if (csrf > Date.now()) {
    next()
  } else {
    res.status(400).json({ message: 'CSRF Token Expired' })
  }
}

/**
 * This is the route to get your CSRF token.
 */
app.get('/', (_req, res) => {
  res.status(200).json({ csrf: Date.now() + (30 * 60 * 1000) })
})

/**
 * Login with their email first.
 * For more security, you can put a middleware where you can assert whether the user
 * is sending an API Key or not.
 * You can also verify/validate the input being sent.
 */
app.post('/email', csrfProtection, async (req, res) => {
  try {
    // This one is called object destructuring. It's an interesting trick in ES6 Javascript
    const { email } = req.body

    // Generate a passphrase with generate-passphrase library (made by me), using the pattern of all word
    // See the generate-passphrase repository: https://github.com/aldy505/generate-passphrase
    const passphrase = generate({ pattern: 'WWW' })

    // Hashing the generated passphrase with argon2id algorithm, then store this one to the database.
    // We're not storing plain passphrase as the database, because we should treat that like a password.
    // See the argon2 repository: https://github.com/ranisalt/node-argon2
    const hashed = await hash(passphrase, { type: argon2id })

    // We will set an expiry time of 30 minutes. Date.now() function returns UNIX timestamp.
    // Add 1000 (1 second in milliseconds) x 60 (1 minute in seconds) x 30 (minutes)
    const expiry = Date.now() + (1000 * 60 * 30)
    
    // I'm using Knex (https://knexjs.org/) as a query builder rather than plain MySQL library.
    // You'll never know, some guys might prefer PostgreSQL better than MySQL, or even they prefer more of SQLite.
    await db.transaction(trx => {
      trx('users')
        .insert({
          email: email,
          passphrase: hashed,
          expiry: expiry,
        })
        .transacting(trx)
        .then(trx.commit)
        .catch(trx.rollback)
    })
    
    /**
     * Let's send the passphrase through email with Nodemailer
     * For more about Nodemailer: https://nodemailer.com/
     */
    const transporter = createTransport({
      host: '',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: '', // generated ethereal user
        pass: '', // generated ethereal password
      },
    })
    await transporter.sendMail({
      from: `2FA Sample Server <noreply@ethereal.email>`,
      to: email,
      subject: "Your 2FA code",
      html: `<!DOCTYPE html><body><h2>${passphrase}</h2><p>Don't lose it. Will expire in 30 minutes</p></body>`,
      text: `${passphrase} - Don't lose it. Will expire in 30 minutes.`
    })

    res.status(200).json({ passphrase: hashed })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error })
  }
})

/**
 * Submit the passphrase they received into the 
 */
app.post('/passphrase', csrfProtection, async (req, res) => {
  try {
    const { email, passphrase } = req.body

    // Send a STATUS CODE 400 response if passphrase was not supplied
    if (!passphrase) {
      res.status(400).json({ message: "No passphrase was sent" })
    }

    // Select passphrase and expiry row from the database.
    const hashed = await db('users').where({ email: email }).select(['passphrase', 'expiry'])

    // Check if now is before the expiry time.
    if (Date.now() < hashed[0].expiry) {
      const verified = await verify(hashed[0].passphrase, passphrase)
      if (verified) {
        res.status(200).json({ message: "Login success" })
      } else {
        res.status(400).json({ message: "Invalid passphrase. Did you put the wrong passphrase?" })
      }
    } else {
      res.status(400).json({ message: "The passphrase already expired" })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error })
  }
})

app.listen(3000, () => {
  initializeDatabase()
  console.log('Server started on http://localhost:3000')
})