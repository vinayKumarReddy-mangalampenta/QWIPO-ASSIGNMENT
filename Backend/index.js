const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const { v4: uuidV4 } = require("uuid");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

let db;

function connectToDBAndStartServer() {
	db = new sqlite3.Database("customers.db", (err) => {
		if (err) {
			console.error(err.message);
			process.exit(1); // Exit the process if the connection fails
		}
		console.log("Connected to the SQLite database.");
		db.run("PRAGMA foreign_keys = ON");

		app.listen(port, () => {
			console.log(`Server listening on port ${port}`);
		});
	});
}

connectToDBAndStartServer();

// * Creating customer data

app.post("/customers", (req, res) => {
	const { firstName, lastName, phoneNumber, email, address } = req.body;

	const validateName = (name) => /^[A-Za-z]+$/.test(name);
	const validatePhone = (phone) => /^\d{10}$/.test(phone);
	const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	// Validate input data
	if (!firstName || !lastName || !phoneNumber || !email || !address) {
		return res.status(400).json({ error: "Missing required fields" });
	}

	// Validate first name and last name (only letters)
	if (!validateName(firstName)) {
		return res
			.status(400)
			.json({ message: "Invalid first name. Only letters are allowed." });
	}

	if (!validateName(lastName)) {
		return res
			.status(400)
			.json({ message: "Invalid last name. Only letters are allowed." });
	}

	// Validate phone (10 digits)
	if (!validatePhone(phoneNumber)) {
		return res
			.status(400)
			.json({ message: "Invalid phone number. Must be exactly 10 digits." });
	}

	// Validate email (proper email format)
	if (!validateEmail(email)) {
		return res.status(400).json({ message: "Invalid email format." });
	}
	let customerId = uuidV4();

	db.run("BEGIN TRANSACTION");
	// Insert customer data into the database

	db.run(
		`INSERT INTO customers (id, firstName, lastName, phoneNumber, email) VALUES (?, ?, ?, ?, ?)`,
		[customerId, firstName, lastName, phoneNumber, email],
		(err) => {
			if (err) {
				console.error("Error inserting customer:", err);
				db.run("ROLLBACK");

				res.status(500).json({ error: "Error creating customer" });
			} else {
				db.run(
					`INSERT INTO addresses (address_id, customer_id, address, is_primary) VALUES (?, ?, ?, ?)`,
					[uuidV4(), customerId, address, 1],
					function (err) {
						if (err) {
							console.error("Error inserting address:", err);
							db.run("ROLLBACK");
							res.status(500).json({ error: "Error creating customer" });
							return;
						} else {
							db.run("COMMIT", function (err) {
								if (err) {
									db.run("ROLLBACK");
									res.status(500).json({ error: "Error creating customer" });
									return;
								}
								console.log("Transaction committed successfully.");
								res
									.status(201)
									.json({ message: "Customer created successfully" });
							});
						}
					}
				);
			}
		}
	);
});

// **Update Customer (PUT /customers/:id)**
app.put("/customers/:id", (req, res) => {
	const customerId = req.params.id;
	const { firstName, lastName, phoneNumber, email } = req.body;

	const validateName = (name) => /^[A-Za-z]+$/.test(name);
	const validatePhone = (phone) => /^\d{10}$/.test(phone);
	const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	// Validate input data
	if (!firstName || !lastName || !phoneNumber || !email) {
		return res.status(400).json({ error: "Missing required fields" });
	}

	// Validate first name and last name (only letters)
	if (!validateName(firstName)) {
		return res
			.status(400)
			.json({ message: "Invalid first name. Only letters are allowed." });
	}

	if (!validateName(lastName)) {
		return res
			.status(400)
			.json({ message: "Invalid last name. Only letters are allowed." });
	}

	// Validate phone (10 digits)
	if (!validatePhone(phoneNumber)) {
		return res
			.status(400)
			.json({ message: "Invalid phone number. Must be exactly 10 digits." });
	}

	// Validate email (proper email format)
	if (!validateEmail(email)) {
		return res.status(400).json({ message: "Invalid email format." });
	}

	db.run("BEGIN TRANSACTION");

	// Update customer data in the database
	db.run(
		"UPDATE customers SET firstName = ?, lastName = ?, phoneNumber = ?, email = ? WHERE id = ?",
		[firstName, lastName, phoneNumber, email, customerId],
		(err) => {
			if (err) {
				console.error(err.message);
				db.run("ROLLBACK");
				res.status(500).json({ error: "Error updating customer" });
			} else {
				db.run("COMMIT", function (err) {
					if (err) {
						console.error("Error committing transaction:", err);
						db.run("ROLLBACK");
						res.status(500).json({ error: "Error updating customer" });
						return;
					}
					console.log("Transaction committed successfully.");
				});
				res.json({ message: "Customer updated successfully" });
			}
		}
	);
});

// **Delete Customer (DELETE /customers/:id)**
app.delete("/customers/:id", (req, res) => {
	const customerId = req.params.id;

	db.run("BEGIN TRANSACTION");
	// Delete the customer
	db.run("DELETE FROM customers WHERE id = ?", [customerId], (err) => {
		if (err) {
			console.error(err.message);
			db.run("ROLLBACK");
			res.status(500).json({ error: "Error deleting customer" });
		} else {
			db.run("COMMIT", function (err) {
				if (err) {
					console.error("Error committing transaction:", err);
					db.run("ROLLBACK");
					res.status(500).json({ error: "Error deleting customer" });
					return;
				}
				console.log("Transaction committed successfully.");
			});
			res.json({ message: "Customer deleted successfully" });
		}
	});
});

// **Insert address
app.post("/customers/:id/address", (req, res) => {
	const customerId = req.params.id;
	const { address } = req.body;

	if (!address) {
		return res.status(400).json({ error: "Missing required fields" });
	}
	db.run("BEGIN TRANSACTION");

	db.run(
		`INSERT INTO addresses (address_id, customer_id, address, is_primary) VALUES (?, ?, ?, ?)`,
		[uuidV4(), customerId, address, 0],
		(err) => {
			if (err) {
				db.run("ROLLBACK");
				return res.status(500).json({ error: "Error adding address" });
			} else {
				db.run("COMMIT", function (err) {
					if (err) {
						console.error("Error committing transaction:", err);
						db.run("ROLLBACK");
						res.status(500).json({ error: "Error adding address" });
						return;
					}
					res.json({ message: "Address added successfully" });
				});
			}
		}
	);
});

// * update address
app.put("/customers/:customerId/addresses/:addressId", (req, res) => {
	const customerId = req.params.customerId;
	const addressId = req.params.addressId;
	const { address } = req.body;
	if (address === "") {
		return res.status(500).json({ error: "Address can''t be empty" });
	}

	db.run("BEGIN TRANSACTION");

	db.run(
		"UPDATE addresses SET address  = ? WHERE address_id = ? AND customer_id = ?",
		[address, addressId, customerId],
		(err) => {
			if (err) {
				console.error(err.message);
				db.run("ROLLBACK");
				res.status(500).json({ error: "Error updating address" });
			} else {
				db.run("COMMIT", function (err) {
					if (err) {
						console.error("Error committing transaction:", err);
						db.run("ROLLBACK");
						res.status(500).json({ error: "Error updating address" });
						return;
					}
					console.log("Transaction committed successfully.");
				});
				res.json({ message: "Address updated successfully" });
			}
		}
	);
});

// * update primary address
app.put("/customers/:customerId/addresses/:addressId/primary", (req, res) => {
	const customerId = req.params.customerId;
	const addressId = req.params.addressId;

	db.run("BEGIN TRANSACTION");

	db.get(
		"select address_id from addresses where customer_id = ? and address_id = ?",
		[customerId, addressId],
		(err, data) => {
			if (err) {
				console.error(err.message);
				res.status(500).json({ error: "Error updating primary address" });
				return;
			}

			if (data == undefined) {
				res.status(404).json({ error: "address not found" });
				return;
			}

			db.run(
				`update addresses set is_primary = 0 where customer_id = ? and is_primary = 1`,
				[customerId],
				(err) => {
					if (err) {
						db.run("ROLLBACK");
						res.status(500).json({ error: "Error updating primary address" });
						return;
					}
					db.run(
						`update addresses set is_primary = 1 where customer_id = ? and address_id = ?`,
						[customerId, addressId],
						(err) => {
							if (err) {
								db.run("ROLLBACK");
								res
									.status(500)
									.json({ error: "Error updating primary address" });
								return;
							}
							db.run("COMMIT", function (err) {
								if (err) {
									console.error("Error committing transaction:", err);
									db.run("ROLLBACK");
									res
										.status(500)
										.json({ error: "Error updating primary address" });
									return;
								}
								console.log("Transaction committed successfully.");
								res.json({ message: "Primary Address updated successfully" });
							});
						}
					);
				}
			);
		}
	);
});

// * delete address
app.delete("/customers/:customerId/addresses/:addressId", (req, res) => {
	const customerId = req.params.customerId;
	const addressId = req.params.addressId;

	db.get(
		"select is_primary from addresses WHERE address_id = ? AND customer_id = ?",
		[addressId, customerId],
		(err, data) => {
			if (err) {
				res.status(500).json({ error: "Error deleting address" });
				return;
			}
			if (data === undefined) {
				res.status(404).json({ error: "address not found" });
				return;
			}
			console.log(data);
			if (data.is_primary == 1) {
				res.status(500).json({ error: "cannot delete primary address" });
				return;
			}

			db.run("BEGIN TRANSACTION");
			db.run(
				"DELETE FROM addresses WHERE address_id = ? AND customer_id = ?",
				[addressId, customerId],
				(err) => {
					if (err) {
						console.error(err.message);
						db.run("ROLLBACK");
						res.status(500).json({ error: "Error deleting address" });
						return;
					} else {
						db.run("COMMIT", function (err) {
							if (err) {
								console.error("Error committing transaction:", err);
								db.run("ROLLBACK");
								res.status(500).json({ error: "Error deleting address" });
								return;
							}
							console.log("Transaction committed successfully.");
						});
						res.json({ message: "Address deleted successfully" });
					}
				}
			);
		}
	);
});

app.get("/customers", (req, res) => {
	let sql = "SELECT * FROM customers";

	db.all(sql, (err, rows) => {
		if (err) {
			console.error(err.message);
			res.status(500).json({ error: "Error retrieving customers" });
		} else {
			res.json(rows);
		}
	});
});
app.get("/customers/search", (req, res) => {
	const { name, email, phoneNumber } = req.query;

	let sql = "SELECT * FROM customers";
	const params = [];

	if (name) {
		sql += " WHERE firstName LIKE ? OR lastName LIKE ? ";
		params.push(`%${name}%`);
		params.push(`%${name}%`);
	}

	if (email) {
		sql += (sql.includes("WHERE") ? "AND" : " WHERE") + " email = ?";
		params.push(`${email}`);
	} else {
		sql += " OR email = ?";
		params.push(`${name}`);
	}

	if (phoneNumber) {
		sql += (sql.includes("WHERE") ? "AND" : " WHERE") + " phoneNumber LIKE ?";
		params.push(`%${phoneNumber}%`);
	} else {
		sql += " OR phoneNumber LIKE ? ";
		params.push(`%${name}%`);
	}

	db.all(sql, params, (err, rows) => {
		if (err) {
			console.error(err.message);
			res.status(500).json({ error: "Error retrieving customers" });
		} else {
			res.json(rows);
		}
	});
});
