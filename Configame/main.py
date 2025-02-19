import os
import sys
import threading

from skillboard import app, setup_tray_icon, open_browser


if __name__ == '__main__':
    # Redirect stdout and stderr to os.devnull if running without a console
#    if not sys.stdout:
#        sys.stdout = open(os.devnull, 'w')
#        sys.stderr = open(os.devnull, 'w')
    
                # Create the image
                #img = create_image()

                # Save the image to a file
                #img.save("tray_icon.png")

    # Start a thread to open the browser
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Start the tray icon in a separate thread
    #threading.Thread(target=setup_tray_icon, daemon=True).start()
    
    app.run(host='0.0.0.0', port=1313, debug=True)