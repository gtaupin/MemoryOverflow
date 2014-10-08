(function() {
  'use strict';

  var fs = require('fs'),
      path = require('path'),
      spawn = require('child_process').spawn,
      Card = require('./card').Card,
      CardReadme = require('./card-readme').CardReadme,
      FileUtils = require('../file/file.js').File,
      ProgressBar = require('progress'),
      wkhtmltoimagePath = process.env.WKHTMLTOIMAGE_PATH || 'wkhtmltoimage/wkhtmltoimage';

  function _endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }

  var CardsGenerator = function(templateFile, templateName, lang) {
    var _bar = null,
        _cardsToLoad = 0,
        _loadedCards = [],
        _cardsToGenerate = 0,
        _onGenerationComplete = false,
        _cards = [];

    function _loadCards() {

      var atLeastOneCard = false;

      _cardsToLoad = 0;

      FileUtils.listFiles(path.join(__dirname, '../../../cards'), function(error, files) {

        if (!error) {
          // first, find the markdown files
          files.forEach(function(file) {
            if (_endsWith(file, 'md') && !_endsWith(file, 'README.md')) {
              var name = path.basename(file, '.md');
              _cards[name] = new Card(file, templateFile, name);
              _cardsToLoad ++;
            }
          });

          // then the configuration files
          files.forEach(function(file) {
            if (_endsWith(file, 'po')) {
              var name = path.basename(file, '.po'),
                  splited = name.split('.'),
                  fileLang = splited[1];

              if (!lang || lang == fileLang) {
                atLeastOneCard = true;

                _cards[splited[0]].languageFiles(fileLang, file);
              }
            }
            else if (_endsWith(file, 'README.md')) {
              var name = FileUtils.dirname(file);

              if (_cards[name]) {
                _cards[name].readmeFile(file);
              }
            }
          });
        }

        if (atLeastOneCard) {
          _bar = new ProgressBar('Loading cards [:bar] :current / :total', {
            complete: '=',
            incomplete: ' ',
            width: _cardsToLoad * 4,
            total: _cardsToLoad
          });

          _bar.render();

          for (var file in _cards) {
            _loadCard(_cards[file]);
          }
        }
        else {
          console.log('No cards to generate');
        }

      });
    }

    function _loadCard(card) {
      card.load(function(error, loadedCards) {
        if (error) {
          throw new Error(error);
        }

        if (_bar) {
          _bar.tick();
        }

        new CardReadme(card).generate();

        _loadedCards = _loadedCards.concat(loadedCards);

        _cardsToLoad --;
        if (_cardsToLoad === 0) {
          console.log('Loading cards : Done');

          _generateCards();
        }
      });
    }

    function _generateCards() {
      _cardsToGenerate = Object.keys(_loadedCards).length;

      _bar = new ProgressBar('Generating cards [:bar] :current / :total', {
        complete: '=',
        incomplete: ' ',
        width: _cardsToGenerate * 4,
        total: _cardsToGenerate
      });

      _bar.render();

      _loadedCards.forEach(function(card) {
        _generateCard(card.html, card.name, card.code, card.lang);
      });
    }

    function _generateCard(html, card, code, lang) {
      var output = card + (code ? '-' + code : '') + (lang ? '.' + lang : ''),
          htmlFile = FileUtils.directory(path.join(__dirname, '../../../website/data', 'cards', templateName)) + '/' + output + '.html';

      fs.writeFile(htmlFile, html, function(err) {
        if (err) {
          throw new Error(err);
        }

        try {
          spawn(
            wkhtmltoimagePath,
            ['--disable-javascript', htmlFile, FileUtils.directory(path.join(__dirname, '../../../website/data', 'print', templateName)) + '/' + output + '.jpg']
          ).stdout.on('end', function() {
            if (_bar) {
              _bar.tick();
            }

            _cardsToGenerate --;
            if (_cardsToGenerate === 0) {
              console.log('Generating cards : Done');

              if (_onGenerationComplete) {
                _onGenerationComplete();
              }
            }
          });
        }
        catch (err1) {
          throw new Error(err1);
        }
      });
    }

    this.generate = function(onGenerationComplete) {
      _onGenerationComplete = onGenerationComplete || false;

      _loadCards();
    };

  };

  exports.CardsGenerator = CardsGenerator;

})();