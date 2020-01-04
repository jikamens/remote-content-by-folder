FILES := LICENSE README.md bootstrap.js chrome.manifest \
         content/defaultPreferencesLoader.jsm content/options.xul \
         content/options.js content/prefs.js manifest.json icon48.png \
         icon96.png content/kickstarter.jsm content/kickstarter.xul \
	 $(wildcard locale/*/kickstarter.dtd)

all: remote-content-by-folder.xpi

remote-content-by-folder.xpi: Makefile $(FILES)
	./send-later/utils/make-kickstarter.sh
	-rm -f $@.tmp
	zip -r $@.tmp $^
	mv -f $@.tmp $@

clean:
	-rm -f *.tmp *.xpi
