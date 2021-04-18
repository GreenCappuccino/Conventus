import {DataTypes, Sequelize} from 'sequelize';
import path from 'path';
import fs from 'fs';
import connect_session_sequelize from 'connect-session-sequelize';
import session from 'express-session';

if (!fs.existsSync(path.join(__dirname, 'db'))) fs.mkdirSync(path.join(__dirname, 'db'));

const originDB: Sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: path.join(__dirname, 'db', 'database.sqlite'),
});

// Authentication
const SessionStore = connect_session_sequelize(session.Store);
export const Sessions = new SessionStore({
	db: originDB,
	tableName: 'sessions',
});

export const Passports = originDB.define('passports', {
	userid: {
		type: DataTypes.STRING,
		unique: true,
	},
	avatar: DataTypes.STRING,
	display: DataTypes.STRING,
	username: DataTypes.STRING,
	provider: DataTypes.STRING,
});

// Clubs
export const Clubs = originDB.define('clubs', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
	name: {
		type: DataTypes.STRING,
	},
	description: {
		type: DataTypes.STRING,
	},
});

// Membership Table
export const Memberships = originDB.define('membership',{
	userid: {
		type: DataTypes.STRING,
	},
	clubsnowflake: {
		type: DataTypes.STRING,
	},
	level: DataTypes.INTEGER, // Membership level... higher means more permissions
});


//Chatlog
export const Chatlog = originDB.define('chatlog', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
	userid: {
		type: DataTypes.STRING,
	},
	textdata: {
		type: DataTypes.TEXT,
	},
	chatlogchat: {
		type: DataTypes.STRING,
	},

});

//chat
export const Chat = originDB.define('chat', {
	snowflake: {
		type: DataTypes.STRING,
	},
	usersnowflake: {
		type: DataTypes.STRING,
	},

});

export const Streams = originDB.define('streams', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
	type: DataTypes.STRING, // 'user' or 'club'
	owner: DataTypes.STRING, // either the user id or club snowflake
});

export const Posts = originDB.define('posts', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
	stream: DataTypes.STRING, // the id of the stream the post of part of
	author: DataTypes.STRING, // the id of the user (passport) who created the post
	time: DataTypes.INTEGER,
	title: DataTypes.STRING,
	content: DataTypes.TEXT,
});

export const Widgets = originDB.define('widgets', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
});

export const syncModels = () => {
	Sessions.sync();
	Passports.sync();
	Chatlog.sync();
	Memberships.sync();
	Chat.sync();
	Clubs.sync();
	Streams.sync();
	Posts.sync();
	Widgets.sync();
};
