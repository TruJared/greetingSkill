const https = require('https');

// cool comments
// ! wow
// * note to self
// ? whaaaaat?
// todo delete the above helper comments...

exports.handler = (event, context) => {
  // -- FUNCTIONS -- //

  // build responses
  const buildResponse = (options) => {
    const response = {
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'SSML',
          ssml: `<speak>${options.speechText}</speak>`,
        },
        shouldEndSession: options.endSession,
      },
    };

    if (options.repromptText) {
      response.response.reprompt = {
        outputSpeech: {
          type: 'SSML',
          ssml: `<speak>${options.repromptText}</speak>`,
        },
      };
    }

    if (options.session && options.session.attributes) {
      response.sessionAttributes = options.session.attributes;
    }
    return response;
  };

  // change speech output based on time of day
  const timeOfDay = () => {
    // only works for demo. needs to get user time zone or time
    const myDate = new Date();
    let hours = myDate.getUTCHours() - 5;

    // if below 0
    if (hours < 0) {
      hours += 24;
    }

    // customize greeting
    if (hours < 12) {
      return 'Good morning';
    }
    if (hours <= 17) {
      return 'Good afternoon';
    }
    return 'Good evening';
  };

  // get quote
  const getQuote = (callback) => {
    const url = 'https://api.forismatic.com/api/1.0/json?method=getQuote&lang=en&format=json';
    const req = https.get(url, (res) => {
      let body = '';
      let quote = '';

      res.on('data', (d) => {
        body += d;
      });
      res.on('end', () => {
        // remove escape characters
        body = body.replace(/\\/g, '');
        quote = JSON.parse(body);
        callback(quote.quoteText);
      });
    });

    req.on('error', (err) => {
      callback('', err);
    });
  };

  // handle launch request
  const handleLaunchRequest = (context) => {
    const options = {
      speechText:
        'Welcome to greetings skill. With this skill you can greet your guests. Whom would you like to greet? ',
      repromptText: 'You can say, for example, greet John.',
      endSession: false,
    };

    context.succeed(buildResponse(options));
  };

  // handle hello intent
  const handleHelloIntent = (request, context) => {
    const name = request.intent.slots.FirstName.value;
    const audioSample = "<audio src='https://s3.amazonaws.com/ask-soundlibrary/human/amzn_sfx_large_crowd_cheer_03.mp3'/>";
    const options = {
      speechText: `${timeOfDay()} ${name}, your name is spelled <say-as interpret-as="spell-out">${name}</say-as> ${audioSample}`,
      endSession: true,
    };
    // get quote
    getQuote((quote, err) => {
      if (err) {
        context.fail(err);
      } else {
        options.speechText += `Here is a cool quote for you... ${quote}`;
        // send voice output
        context.succeed(buildResponse(options));
      }
    });
  };
  // handle quote and next quote
  // TODO fix bug with reprompt //
  const handleQuoteIntent = (request, context, session) => {
    const options = {
      // clears speechText
      speechText: '',
      reprompt: 'You can say yes or no.',
      session,
    };
    // get quote
    getQuote((quote, err) => {
      if (err) {
        context.fail(err);
      } else {
        options.speechText += `Here is a cool quote for you... ${quote}. Would you like to hear another quote? You can say yes or stop`;
        options.session.attributes.quoteIntent = true;
        options.endSession = false;
        // send voice output
        context.succeed(buildResponse(options));
      }
    });
  };
  const handleNextQuoteIntent = (request, context, session) => {
    const options = {
      // clears speechText
      speechText: '',
      reprompt: 'You can say yes or no.',
      session,
    };

    if (session.attributes.quoteIntent) {
      // get quote
      getQuote((quote, err) => {
        if (err) {
          context.fail(err);
        } else {
          options.speechText += `Here is a cool quote for you... ${quote}. Would you like to hear another quote? You can say yes or stop.`;
          options.session.attributes.quoteIntent = true;
          options.endSession = false;

          // send voice output
          context.succeed(buildResponse(options));
        }
      });
    } else {
      options.speechText += 'Wrong invocation of this intent';
      options.endSession = true;
    }
  };

  // main program
  try {
    const { request } = event;
    const { session } = event;

    // check for event session and create if NOT exist
    if (!session.attributes) {
      session.attributes = {};
    }

    // request types
    if (request.type === 'LaunchRequest') {
      handleLaunchRequest(context);
    } else if (request.type === 'IntentRequest') {
      if (request.intent.name === 'HelloIntent') {
        handleHelloIntent(request, context);
      } else if (request.intent.name === 'QuoteIntent') {
        handleQuoteIntent(request, context, session);
      } else if (request.intent.name === 'NextQuoteIntent') {
        handleNextQuoteIntent(request, context, session);
      } else if (
        request.intent.name === 'AMAZON.StopIntent'
        || request.intent.name === 'AMAZON.CancelIntent'
      ) {
        context.succeed(
          buildResponse({
            speechText: 'Goodbye',
            endSession: true,
          }),
        );
      } else {
        context.fail('Unknown intent type');
      }
    } else if (request.type === 'SessionRequest') {
    } else {
      throw new Error('Unknown intent type');
    }
  } catch (e) {
    context.fail(`Exception ${e}`);
  }
};
