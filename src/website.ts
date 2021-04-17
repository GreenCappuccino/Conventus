import express, {Express} from 'express';
import exphbs from 'express-handlebars';
import * as log4js from 'log4js';
import {Logger} from 'log4js';
import path from 'path';
import passport from 'passport';
import cors from 'cors';
import session from 'express-session';
import {ensureLoggedIn} from 'connect-ensure-login';
import {Model} from 'sequelize/types';
import {Strategy as GoogleStrategy} from 'passport-google-oauth2';


interface User {
	user_id: string,
	username: string,
	display: string,
	avatar: string,
	provider: string,
}

export class Webserver {

	port: number;
	logger: Logger;
	web: Express;
	users: Map<string, User>;

	constructor(port: number) {
		this.port = port;
		this.users = new Map<string, User>();
		this.logger = log4js.getLogger('website');
		this.web = express();

		this.web.use(express.static(path.join(__dirname, 'static')));

		this.web.use(cors());
		this.web.use(express.urlencoded({
			extended: true,
		}));
		/*
		this.web.use(session({
			secret: process.env.VAXFINDER_SESSION_SECRET,
			resave: false,
			saveUninitialized: false,
		}));*/
		this.web.use(passport.initialize());
		this.web.use(passport.session());

		passport.serializeUser(((user: User, done) => {
			done(null, user.user_id);
		}));

		passport.deserializeUser(((id: string, done) => {
			done(null, this.users.get(id));
		}));
		/*
		passport.use(new GoogleStrategy({
			clientID: process.env.VAXFINDER_GOOGLE_CLIENT_ID,
			clientSecret: process.env.VAXFINDER_GOOGLE_CLIENT_SECRET,
			callbackURL: `${process.env.VAXFINDER_HOST}/login/google/callback`,
			passReqToCallback: false},
		(accessToken, refreshToken, profile, cb) => {
			this.logger.trace(profile);
			this.users.set(profile.id, {
				avatar: profile.photos.filter(photo => photo.type === 'default')[0]?.value,
				display: profile.given_name,
				user_id: profile.id,
				username: profile.id,
				provider: 'Google',
			});
			return cb(null, this.users.get(profile.id));
		},
		));*/
		this.web.engine('handlebars', exphbs());
		this.web.set('views', path.join(__dirname, 'views'));
		this.web.set('view engine', 'handlebars');

		this.web.get('/', ((req, res) => {
			res.send('READY');
		}))

		this.logger.info('Webserver loaded.');
	}

	public start(): void {
		this.web.listen(this.port, '0.0.0.0',() => this.logger.info('Webserver started.'));
	}

	private static addUserData(req) {
		return {
			loggedIn: req.isAuthenticated(),
			userDisplay: req.user?.display,
			avatar: req.user?.avatar,
			provider: req.user?.provider,
		};
	}
}
