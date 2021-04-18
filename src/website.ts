import express, {Express} from 'express';
import exphbs from 'express-handlebars';
import * as log4js from 'log4js';
import {Logger} from 'log4js';
import path from 'path';
import passport from 'passport';
import cors from 'cors';
import session from 'express-session';
import {ensureLoggedIn} from 'connect-ensure-login';
import {Model, where} from 'sequelize/types';
import {Strategy as GoogleStrategy} from 'passport-google-oauth2';
import {Passports, Posts, Sessions, Streams} from './models';
import * as xss from 'xss';


interface User {
	user_id: string,
	username: string,
	display: string,
	avatar: string,
	provider: string,
}

interface Post {
	snowflake: string,
	stream: string,
	author: User,
	timeISO: string,
	timeString: string,
	title: string,
	content: string,
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
		this.web.use(session({
			secret: process.env.CONVENTUS_SESSION_SECRET,
			store: Sessions,
			resave: false,
			saveUninitialized: false,
		}));
		this.web.use(passport.initialize());
		this.web.use(passport.session());

		passport.serializeUser(((user: User, done) => {
			done(null, user.user_id);
		}));

		passport.deserializeUser(((id: string, done) => {
			Passports.findOne({
				where: {
					userid: id,
				},
			}).then((userModel) => {
				const user: User = {
					user_id: userModel['userid'],
					avatar: userModel['avatar'],
					username: userModel['username'],
					display: userModel['display'],
					provider: userModel['provider'],
				};
				done(null, user);
			}).catch((e) => {
				done(e);
			});
		}));

		passport.use(new GoogleStrategy({
			clientID: process.env.CONVENTUS_GOOGLE_CLIENT_ID,
			clientSecret: process.env.CONVENTUS_GOOGLE_CLIENT_SECRET,
			callbackURL: `${process.env.CONVENTUS_HOST}/login/google/callback`,
			passReqToCallback: false},
		(accessToken, refreshToken, profile, cb) => {
			this.logger.trace(profile);
			const user: User = {
				user_id: profile.id,
				avatar: profile.photos.filter(photo => photo.type === 'default')[0]?.value,
				username: profile.displayName,
				display: profile.given_name,
				provider: 'Google',
			};
			const model = {
				userid: user.user_id,
				avatar: user.avatar,
				display: user.display,
				username: user.username,
				provider: user.provider,
			};
			Passports.upsert(model).then(() => {
				cb(null, user);
			}).catch((e) => {
				this.logger.error(e);
				cb(e);
			});
		}));
		this.web.engine('handlebars', exphbs());
		this.web.set('views', path.join(__dirname, 'views'));
		this.web.set('view engine', 'handlebars');

		this.web.get('/', ((req, res) => {
			res.render('home', {
				data: Webserver.addUserData(req),
			});
		}));

		this.web.get('/chats', ensureLoggedIn('/login/google'), (req, res) => {
			res.render('chats', {
				data: Webserver.addUserData(req),
			});
		});

		this.web.post('/addSelfPost', ensureLoggedIn('/login/google'), (req, res, next) => {
			Posts.create({
				snowflake: Date.now(),
				stream: req['user'].user_id,
				author: req['user'].user_id,
				time: Date.now(),
				title: xss.filterXSS(req.body.title),
				content: xss.filterXSS(req.body.content),
			}).then(() => {
				res.redirect('/stream');
			}).catch((e) => {
				this.logger.error(e);
				next(e);
			});
		});

		this.web.get('/delSelfPost', ensureLoggedIn('/login/google'), (req, res, next) => {
			Posts.destroy({
				where: {
					author: req['user'].user_id,
					snowflake: req.query.snowflake,
				},
			}).then(() => {
				res.redirect('/stream');
			}).catch((e) => {
				this.logger.error(e);
				next(e);
			});
		});

		this.web.get('/stream', ensureLoggedIn('/login/google'), (req, res, next) => {
			Streams.upsert({
				snowflake: req['user'].user_id,
				type: 'user',
				owner: req['user'].user_id,
			}).then(model => {
				return Posts.findAll({
					where: {
						stream: req['user'].user_id,
					},
				});
			}).then((models) => {
				const posts: Post[] = [];
				for (let i = 0; i < models.length; i++) {
					posts.unshift({ // unshift as posts appear from latest to oldest
						author: req['user'],
						title: models[i]['title'],
						content: models[i]['content'],
						snowflake: models[i]['snowflake'],
						stream: models[i]['stream'],
						timeISO: new Date(models[i]['time']).toISOString(),
						timeString: new Date(models[i]['time']).toDateString(),
					});
				}
				res.render('stream', {
					data: { posts, ...Webserver.addUserData(req)},
				});
			}).catch((e) => {
				this.logger.error(e);
				next(e);
			});
		});

		// Login Code
		this.web.get('/login/google/callback',
			passport.authenticate('google', { failureRedirect: '/login' }),
			function(req, res) {
				res.redirect('/');
			},
		);
		this.web.get('/logout', function (req, res) {
			req.session.destroy(() => res.redirect('/'));
		});

		this.web.get('/login/google', passport.authenticate('google', { scope: ['profile'] }));

		// Error handlers -- KEEP LAST!!!
		this.web.use(((req, res, next) => {
			res.status(404).render('404', {
				data: Webserver.addUserData(req),
			});
		}));
		this.web.use((err, req, res, next) => {
			this.logger.error(req);
			res.status(500).render('500', {
				data: Webserver.addUserData(req),
			});
		});
		this.logger.info('Webserver loaded.');
	}

	public start(): void {
		this.web.listen(this.port, '0.0.0.0',() => this.logger.info('Webserver started.'));
	}

	private static addUserData(req) {
		return {
			loggedIn: req.isAuthenticated(),
			userDisplay: req.user?.display,
			username: req.user?.username,
			avatar: req.user?.avatar,
			provider: req.user?.provider,
		};
	}
}
