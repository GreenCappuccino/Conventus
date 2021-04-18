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
export const Users = originDB.define('users', {
	userid: {
		type: DataTypes.STRING,
		unique: true,
	},
	username: DataTypes.STRING,
});

export const Clubs = originDB.define('clubs', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
});


//Chatlog
export const Chatlog = originDB.define('chatlog', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true
	},
	userid: {
		type: DataTypes.STRING,
	},
	textdata: {
		type: DataTypes.TEXT
	},
	chatlogchat: {
		type: DataTypes.STRING
	}

});

//chat
export const Chat = originDB.define('chat', {
	snowflake: {
		type: DataTypes.STRING
	},
	usersnowflake: {
		type: DataTypes.STRING
	},

})

export const Streams = originDB.define('streams', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
});

export const Posts = originDB.define('posts', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	},
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
	Users.sync();
	Chatlog.sync();
	Chat.sync();
	Clubs.sync();
	Streams.sync();
	Posts.sync();
	Widgets.sync();
};
