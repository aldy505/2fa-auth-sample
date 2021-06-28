import { App, NextFunction, Request, Response } from "@tinyhttp/app"
import { cookieParser } from "@tinyhttp/cookie-parser"
import { cors } from "@tinyhttp/cors"
import { argon2id, hash, verify } from "argon2"
import { generate } from "generate-passphrase"
import { json } from "milliparsec"
import { createTransport } from "nodemailer"
import { csrf, CSRFRequest } from "malibu"
import { db, initializeDatabase } from "./database"

const app = new App<any, Request & CSRFRequest>()

app.use(cors())
app.use(json())
app.use(cookieParser('ARHCopjV5eC48Cqcug5JFxSS7gtEz5Jr'))

const csrfProtection = csrf({ cookie: { signed: true } })

/**
 * This is the route to get your CSRF token.
 */
 app.get('/', csrfProtection, (req: Request & CSRFRequest, res: Response) => {
  res.status(200).json({ csrf: req.csrfToken() })
})

/**
 * Login with their email first.
 * For more security, you can put a middleware where you can assert whether the user
 * is sending an API Key or not.
 * You can also verify/validate the input being sent.
 */
app.post('/email', csrfProtection, async (req: Request, res: Response) => {
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
app.post('/passphrase', csrfProtection, async (req: Request, res: Response) => {
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