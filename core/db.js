'use strict';

let mysql  = require('mysql'),
    moment = require('moment');

// TODO: refactor
let pool = mysql.createPool({
    host              : process.env.MYSQL_HOST || 'localhost',
    user              : process.env.MYSQL_USER || '',
    password          : process.env.MYSQL_PASS || '',
    database          : process.env.MYSQL_DB   || '',
    //socketPath        : '/var/run/mysqld/mysqld.sock',
    connectionLimit   : 30,
    supportBigNumbers : true
});

exports.toggleEntryStatus = function(id, state, callback){
    pool.getConnection(function(err, connection) {
        if(err) { console.log(err); callback(true); return; }
        // TODO: UPDATE STATUS
        // 1 = confirmed | 2 = removed
        let sql;
        if(state === '1' || state === '2'){
          sql  = "UPDATE entries SET status = "+state+" WHERE id = "+id;
        }else{
          callback({}, false);
          return;
        }

        // make the query
        connection.query(sql, function(err, results) {
            connection.release();
            if(err) { callback(results, true); return; }
            callback(results, false);
        });
    });
};

exports.isValidApiKey = function(secret, callback){
    pool.getConnection(function(err, connection) {
        if(err) { console.log(err); callback(true); return; }
        let sql  = "SELECT valid from apikeys WHERE secret = '"+secret+"';";

        console.log(sql);

        // make the query
        connection.query(sql, function(err, results) {
            connection.release();
            if(err) { callback(results, true); return; }
            callback(results, false);
        });
    });
};

exports.getEntries = function(limit, offset, active, callback){
    pool.getConnection(function(err, connection) {
        if(err) { console.log(err); callback(true); return; }
        let sql = '';
        if(active === '0'){
            sql  = "SELECT * FROM entries ORDER BY ID DESC LIMIT "+limit+" OFFSET "+offset+";";
        }else{
            sql = "SELECT * FROM entries WHERE email_confirmed = 1 AND status = 1 ORDER BY ID DESC LIMIT "+limit+" OFFSET "+offset+";";
        }

        console.log(sql);

        // make the query
        connection.query(sql, function(err, results) {
            connection.release();
            if(err) { callback(results, true); return; }
            callback(results, false);
        });
    });
};

exports.getUserByHash = function(hash, callback){
    pool.getConnection(function(err, connection) {
        if(err) { console.log(err); callback(true); return; }
        let sql  = "SELECT email, firstname from entries WHERE confirm_key = '"+hash+"';";

        // make the query
        connection.query(sql, function(err, results) {
            connection.release();
            if(err) { callback(results, true); return; }
            callback(results, false);
        });
    });
};

exports.verifyEntry = function(hash, callback){
    pool.getConnection(function(err, connection) {
        if(err) { console.log(err); callback(true); return; }
        let sql  = "UPDATE entries set email_confirmed = 1, confirmed_at = "+moment().valueOf()+" WHERE";
            sql += " confirm_key = '"+hash+"' AND";
            sql += " confirmed_at is null;";

        // make the query
        connection.query(sql, function(err, results) {
            connection.release();
            if(err || results.affectedRows < 1) { callback(results, true); return; }
            callback(results, false);
        });
    });
};

exports.getCount = function(callback){
    pool.getConnection(function(err, connection) {
        if(err) { console.log(err); callback(true); return; }
        let sql  = "SELECT count(*) as cnt FROM entries WHERE email_confirmed > 0 AND status < 2 AND country != '';";

        // make the query
        connection.query(sql, function(err, results) {
            connection.release();
            if(err) { callback(results, true); return; }
            callback(results, false);
        });
    });
};

exports.saveEntry = function(fields, callback){
    pool.getConnection(function(err, connection) {
        if(err) { console.log(err); callback(true); return; }
        let data = prepareEntry(fields);

        let sqle  = "SELECT count(*) as cnt FROM entries WHERE email = '"+data.email+"';";
        connection.query(sqle, function(err, results) {
            if(!err) {
                if(results[0]['cnt'] > 0){
                    callback(true);
                    return;
                }else{
                    let sql  = "INSERT INTO entries (firstname, lastname, email, country, message, anon, ipv4, image, created_at, updated_at, confirm_key, beta, newsletter, pax) VALUES (";
                        sql += "'"+ data.firstname  + "', ";
                        sql += "'"+ data.lastname   + "', ";
                        sql += "'"+ data.email      + "', ";
                        sql += "'"+ data.country    + "', ";
                        sql += "'"+ data.message    + "', ";
                        sql +=      data.anon       + ", ";
                        sql += "'"+ data.ipv4       + "', ";
                        sql += "'"+ data.image      + "', ";
                        sql +=      data.created_at + ", ";
                        sql +=      data.updated_at + ", ";
                        sql += "'"+ data.randomHash + "', ";
                        sql +=      data.beta       + ", ";
                        sql +=      data.newsletter + ", ";
                        sql +=      data.pax        + ");";

                    // run the query
                    connection.query(sql, function(err, results) {
                        connection.release();
                        if(err) { callback(true); return; }
                        callback(false, results);
                    });
                }
            }
        });
    });
};

/*
 * most fields get sanitized and escaped by node-mysql
 * this function is to prevent application errors
 **/
function prepareEntry(data){
    let now = moment().valueOf();

    data["image"] = data["image"].replace("uploads\\", "");

    // set timestamps
    data["created_at"] = now;
    data["updated_at"] = now;

    return data;
}