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
import {Clubs, Memberships, Passports, Posts, Sessions, Streams} from './models';
import * as xss from 'xss';
import { Snowflake } from '@sapphire/snowflake';


interface User {
	user_id: string,
	username: string,
	display: string,
	avatar: string,
	provider: string,
}

interface Club {
	snowflake: string,
	clubname: string,
	description: string,
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

	constructor(port: number) {
		this.port = port;
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

		this.web.get('/privacy-policy', (req, res) => {
			res.render('privacy-policy', {data: Webserver.addUserData(req)});
		});
		this.web.get('/terms-of-use', (req, res) => {
			res.render('terms-of-use', {data: Webserver.addUserData(req)});
		});

		this.web.get('/', ((req, res, next) => {
			const users: User[] = [];
			const posts: Post[] = [];
			const clubs: Club[] = [];
			const userMap: Map<string, User> = new Map<string, User>();
			Passports.findAll().then(userModels => {
				for (let i = 0; i < userModels.length; i++) {
					users.push({
						user_id: userModels[i]['userid'],
						avatar: userModels[i]['avatar'],
						display: userModels[i]['display'],
						username: userModels[i]['username'],
						provider: userModels[i]['provider'],
					});
					userMap.set(userModels[i]['userid'], users[i]);
				}
				Posts.findAll().then(postModels => {
					for (let i = 0; i < postModels.length; i++) {
						posts.unshift({ // unshift as posts appear from latest to oldest
							author: userMap.get(postModels[i]['author']),
							title: postModels[i]['title'],
							content: postModels[i]['content'],
							snowflake: postModels[i]['snowflake'],
							stream: postModels[i]['stream'],
							timeISO: new Date(postModels[i]['time']).toISOString(),
							timeString: new Date(postModels[i]['time']).toDateString(),
						});
					}
					Clubs.findAll().then(clubModels => {
						for (let i = 0; i < clubModels.length; i++) {
							clubs.push({
								snowflake: clubModels[i]['snowflake'],
								clubname: clubModels[i]['name'],
								description: clubModels[i]['description'],
							});
						}
						res.render('home', {
							data: {
								users, posts, clubs,
								...Webserver.addUserData(req),
							},
						});
					}).catch(e => {
						this.logger.error(e);
						next(e);
					});
				}).catch(e => {
					this.logger.error(e);
					next(e);
				});
			}).catch(e => {
				this.logger.error(e);
				next(e);
			});
		}));

		this.web.get('/user',  (req, res, next) => {
			const user = req.query.id ? req.query.id : req['user'].user_id;
			Passports.findOne({where: {userid: user}}).then((userModel) => {
				const posts: Post[] = [];
				const user: User = {
					user_id: userModel['userid'],
					username: userModel['username'],
					display: userModel['display'],
					avatar: userModel['avatar'],
					provider: userModel['provider'],
				};
				Promise.all([
					Posts.findAll({
						where: {author: userModel['userid']},
					}).then((postModels) => {
						for (let i = 0; i < postModels.length; i++) {
							posts.unshift({ // unshift as posts appear from latest to oldest
								author: user,
								title: postModels[i]['title'],
								content: postModels[i]['content'],
								snowflake: postModels[i]['snowflake'],
								stream: postModels[i]['stream'],
								timeISO: new Date(postModels[i]['time']).toISOString(),
								timeString: new Date(postModels[i]['time']).toDateString(),
							});
						}
					}).catch((e) => {
						this.logger.error(e);
						next(e);
					}),
				]).then(() => {
					res.render('user', {
						data: {
							user, posts,
							...Webserver.addUserData(req),
						},
					});
				}).catch((e) => {
					this.logger.error(e);
					next(e);
				});
			}).catch((e) => {
				this.logger.error(e);
				next(e);
			});
		});

		this.web.get('/chats', ensureLoggedIn('/login/google'), (req, res) => {
			res.render('chats', {
				data: {
					...Webserver.addUserData(req),
				},
			});
		});

		this.web.get('/joinClub', ensureLoggedIn('/login/google'), (req,res,next) => {
			if (req.query.id)
				Memberships.findOne({
					where: {
						userid: req['user'].user_id,
						clubsnowflake: req.query.id,
					},
				}).then((model) => {
					if (model === null) {
						Memberships.upsert({
							userid: req['user'].user_id,
							clubsnowflake: req.query.id,
							level: 1,
						}).then(() => {
							res.redirect('/clubs');
						}).catch((e) => {
							this.logger.error(e);
							next(e);
						});
					} else {
						res.redirect('/clubs');
					}
				}).catch((e) => {
					this.logger.error(e);
					next(e);
				});
			else
				res.redirect('/clubs');
		});

		this.web.get('/leaveClub', ensureLoggedIn('/login/google'), (req,res,next) => {
			if (req.query.id)
				Memberships.destroy({
					where: {
						userid: req['user'].user_id,
						clubsnowflake: req.query.id,
					},
				}).then(() => {
					res.redirect('/clubs');
				}).catch((e) => {
					this.logger.error(e);
					next(e);
				});
			else
				res.redirect('/clubs');
		});

		this.web.get('/clubs', ensureLoggedIn('/login/google'), (req, res, next) => {
			Memberships.findAll({
				where: {
					userid: req['user'].user_id,
				},
			}).then((membershipModels) => {
				const clubs: Club[] = [];
				const clubQueries = [];
				for (let i = 0; i < membershipModels.length; i++) {
					clubQueries.push(Clubs.findOne({
						where: {snowflake: membershipModels[i]['clubsnowflake']},
					}).then((clubModel) => {
						clubs.push({
							snowflake: clubModel['snowflake'],
							clubname: clubModel['name'],
							description: clubModel['description'],
						});
					}));
				}
				Promise.all(clubQueries).then(() => {
					res.render('clubs', {
						data: { clubs, ...Webserver.addUserData(req)},
					});
				}).catch((e) => {
					this.logger.error(e);
					next(e);
				});
			}).catch((e) => {
				this.logger.error(e);
				next(e);
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
			user_id: req.user?.user_id,
			userDisplay: req.user?.display,
			username: req.user?.username,
			avatar: req.user?.avatar,
			provider: req.user?.provider,
		};
	}
}
