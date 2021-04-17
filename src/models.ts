import {DataTypes, Sequelize} from 'sequelize';
import path from 'path';
import fs from 'fs';

if (!fs.existsSync(path.join(__dirname, 'db'))) fs.mkdirSync(path.join(__dirname, 'db'));

const originDB: Sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: path.join(__dirname, 'db', 'database.sqlite'),
});

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
	}
});

export const Streams = originDB.define('streams', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	}
});

export const Posts = originDB.define('posts', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	}
});

export const Widgets = originDB.define('widgets', {
	snowflake: {
		type: DataTypes.STRING,
		unique: true,
	}
});

export const syncModels = () => {
	Users.sync()
	Clubs.sync()
	Streams.sync()
	Posts.sync()
	Widgets.sync()
};
