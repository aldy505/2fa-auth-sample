package main

import (
	"database/sql"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type User struct {
	ID         uint   `gorm:"primaryKey;autoIncrement"`
	email      string `gorm:"unique"`
	passphrase string
	expiry     string
}

func Connection() *sql.DB {
	dsn := "root:password@tcp(localhost:3306)/2fa_auth_sample"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		panic(err)
	}
	db.SetConnMaxLifetime(time.Minute * 3)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(10)
	return db
}
