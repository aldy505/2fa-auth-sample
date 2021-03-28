# Backend Code

## Configuration

* Make sure port 3000 is available.
* Please only run one language (or folder). All of them are listening on port 3000. Avoid trouble if you can.
* Create a database named `2fa_auth_sample` on your local database system (preferably MySQL)

## Route & schema for frontend guys

Whatever the language is, this would be the same for the frontend guys to code.

### Acquiring CSRF Token

**Route:** /

**Method:** GET

**Request Body:** No request body needed

**Response Body:**
```json
{
  "csrf": "CSRF-Token......."
}
```

### Sending the first email form

**Route:** /email

**Method:** POST

**Request Body:**
| Key | Type | Description |
| --- | --- | --- |
| `email` | String | User's email |
| `_csrf` | String | CSRF Token |

**Response Body:**

* **Success:** (STATUS 200)
```json
{
  "passphrase": "some-passphrase-string"
}
```
* **Failed:** (STATUS 500)
```json
{
  "message": "Some error messages"
}
```

### Sending the second passphrase form

**Route:** /passphrase

**Method:** POST

**Request Body:**
| Key | Type | Description |
| --- | --- | --- |
| `email` | String | User's email |
| `passphrase` | String | The passphrase from user's email |
| `_csrf` | String | CSRF Token |

**Response Body:**

* **Success:** (STATUS 200)
```json
{
  "message": "Login success"
}
```
* **Failed:** (STATUS 400/500 — Please pay attention to the status code)
```json
{
  "message": "Some error messages"
}
```