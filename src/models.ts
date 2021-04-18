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

// Website Operations
export const Clubs = originDB.define('clubs', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
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
	Clubs.sync();
	Streams.sync();
	Posts.sync();
	Widgets.sync();
};
