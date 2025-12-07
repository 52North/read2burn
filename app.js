const express = require('express');
const http = require('http');
const path = require('path');
const Umzug = require('umzug');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const Datastore = require('@seald-io/nedb');
const routes = require('./routes');
const i18n = require('i18n');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const umzug = new Umzug();

// i18n config (must be before init)
i18n.configure({
  locales: ['en', 'de'],
  directory: path.join(__dirname, 'locales'),
  defaultLocale: 'en'
});

app.use(i18n.init);
app.set('port', process.env.PORT || 3300);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// secure basics
app.disable('x-powered-by');
app.enable('trust proxy');

// performance + security middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  })
);

app.use(compression());

// static files
app.use(express.static(path.join(__dirname, 'public')));

// payload size limit
app.use(bodyParser.urlencoded({ extended: false, limit: '5mb' }));

// database load
const nedb = new Datastore({
  filename: path.join(__dirname, 'data', 'read2burn.db'),
  autoload: true
});
exports.nedb = nedb;

// routing
app.get('/', routes.index);
app.post('/', routes.index);

// migrations
umzug.up().then(() => {});

// periodic cleanup of expired secrets
cron.schedule('*/10 * * * *', () => {
  try {
    const now = Date.now();
    nedb.remove({ expiresAt: { $lte: now } }, { multi: true }, (err, numRemoved) => {
      if (!err && numRemoved > 0) {
        nedb.compactDatafile();
      }
    });
  } catch (err) {
    console.error('Error during periodic cleanup:', err);
  }
});

// start server
http.createServer(app).listen(app.get('port'), () => {
  console.log('Server running on port ' + app.get('port'));
});
