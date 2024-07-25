const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  connectionLimit: 100,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password:process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit:50,
});


pool.getConnection((err,connection)=> {
  if(err) throw err;
  console.log('Database connected successfully');
  connection.release();
}); 

module.exports = pool;


