import * as logging from "./logger";
import * as models from "./models";
import {Webserver} from './website';

logging.setupLogging();
models.syncModels();

const webserver = new Webserver(parseInt(process.env.PORT));

webserver.start();