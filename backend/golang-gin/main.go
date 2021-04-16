package main

import (
	"net/http"
	"strconv"
	"time"

	"golang.org/x/crypto/argon2"

	sq "github.com/Masterminds/squirrel"
	passphrase "github.com/aldy505/go-generate-passphrase"
	"github.com/gin-gonic/gin"
	cors "github.com/rs/cors/wrapper/gin"
	mail "github.com/xhit/go-simple-mail/v2"
)

type EmailRequestBody struct {
	Email string `json:"email"`
}

type PassphraseRequestBody struct {
	Email      string `json:"email"`
	Passphrase string `json:"passphrase"`
}

type CSRFHeader struct {
	XSRFToken string `header:"xsrf-token"`
	CSRFToken string `header:"csrf-token"`
}

type CSRFBody struct {
	CSRF string `json:"_csrf"`
}

func main() {
	db := Connection()

	router := gin.Default()
	router.Use(cors.Default())

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"csrf": (time.Now().Unix() + (30 * 60 * 1000)),
		})
	})

	router.POST("/email", CSRFMiddleware(), func(c *gin.Context) {
		var body EmailRequestBody
		err := c.ShouldBindJSON(&body)
		if err != nil {
			c.JSON(500, gin.H{"message": err.Error()})
		}

		// I created a library for generating passphrase.
		// It is here: https://github.com/aldy505/go-generate-passphrase
		pass, err := passphrase.Generate(&passphrase.Options{
			Pattern: "WWW",
		})
		if err != nil {
			c.JSON(500, gin.H{"message": err.Error()})
		}

		// Hashing the generated passphrase with argon2id algorithm, then store this one to the database.
		// We're not storing plain passphrase as the database, because we should treat that like a password.
		// See the argon2 repository: https://pkg.go.dev/golang.org/x/crypto@v0.0.0-20210415154028-4f45737414dc/argon2#hdr-Argon2id
		salt := []byte("a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447")
		hashed := string(argon2.IDKey([]byte(pass), salt, 1, 64*1024, 4, 32))

		// We will set an expiry time of 30 minutes. time.Now().Unix() function returns UNIX timestamp.
		// Add 1000 (1 second in milliseconds) x 60 (1 minute in seconds) x 30 (minutes)
		expiry := time.Now().Unix() + (1000 * 60 * 30)

		// I'm using Squirrel (https://github.com/Masterminds/squirrel) as a query builder rather than plain MySQL library.
		query := sq.Insert("users").Columns("email", "passphrase", "expiry").Values(body.Email, hashed, expiry)
		query.RunWith(db).QueryRow().Scan()

		// Let's send the passphrase through email
		// I'm using this repository: https://github.com/xhit/go-simple-mail
		email := mail.NewMSG()
		email.SetFrom("2FA Sample Server <noreply@ethereal.email>").
			AddTo(body.Email).
			SetSubject("Your 2FA Code").
			SetBody(mail.TextHTML, "<!DOCTYPE html><body><h2>"+pass+"</h2><p>Don't lose it. Will expire in 30 minutes</p></body>")
		smtpClient := MailSetup()
		err = email.Send(smtpClient)
		if err != nil {
			c.JSON(500, gin.H{"message": err.Error()})
		} else {
			c.JSON(200, gin.H{"passphrase": pass})
		}
	})

	router.POST("/passphrase", CSRFMiddleware(), func(c *gin.Context) {
		var body PassphraseRequestBody
		err := c.ShouldBindJSON(&body)
		if err != nil {
			c.JSON(500, gin.H{"message": err.Error()})
		}
		// Send a STATUS CODE 400 response if passphrase was not supplied
		if body.Passphrase == "" {
			c.JSON(400, gin.H{"message": "No passphrase was sent"})
		}

		// Select passphrase and expiry row from the database.
		var hashed string
		var expiry string
		query := sq.Select("passphrase", "expiry").From("users").Where(sq.Eq{"email": body.Email})
		err = query.RunWith(db).Scan(&hashed, &expiry)
		if err != nil {
			c.JSON(500, gin.H{"message": err.Error()})
		}

		// Check if now is before the expiry time.
		expiryTime, _ := strconv.Atoi(expiry)
		if time.Now().Unix() < int64(expiryTime) {
			verified := VerifyHash(hashed, body.Passphrase)
			if verified {
				c.JSON(200, gin.H{"message": "Login success"})
			} else {
				c.JSON(400, gin.H{"message": "Invalid passphrase. Did you put the wrong passphrase?"})
			}
		} else {
			c.JSON(400, gin.H{"message": "The passphrase already expired"})
		}
	})

	router.Run(":3000")
}

func CSRFMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		var csrfHeader CSRFHeader
		var csrfBody CSRFBody
		c.ShouldBindJSON(&csrfBody)
		c.ShouldBindHeader(&csrfHeader)
		csrfBodyValue, _ := strconv.Atoi(csrfBody.CSRF)
		csrfHeaderCValue, _ := strconv.Atoi(csrfHeader.CSRFToken)
		csrfHeaderXValue, _ := strconv.Atoi(csrfHeader.XSRFToken)
		if int64(csrfBodyValue) > time.Now().Unix() {
			c.Next()
			return
		} else if int64(csrfHeaderCValue) > time.Now().Unix() {
			c.Next()
			return
		} else if int64(csrfHeaderXValue) > time.Now().Unix() {
			c.Next()
			return
		} else {
			c.JSON(400, gin.H{"message": "CSRF Token Expired"})
			return
		}
	}
}

func VerifyHash(hashed string, plain string) bool {
	salt := []byte("a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447")
	plainHashed := argon2.IDKey([]byte(plain), salt, 1, 64*1024, 4, 32)

	if string(plainHashed) == hashed {
		return true
	} else {
		return false
	}
}
