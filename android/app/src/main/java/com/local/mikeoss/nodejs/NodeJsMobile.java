package com.local.mikeoss.nodejs;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.os.Build;
import android.system.ErrnoException;
import android.system.Os;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.concurrent.Semaphore;

/**
 * Embedded Node.js runtime (nodejs-mobile v18.20.4), adapted from
 * nodejs-mobile-react-native's module for use inside the Capacitor shell.
 * Copies android/app/src/main/assets/nodejs-project into internal storage on
 * first boot / app update, then starts the Express server in a background
 * thread.
 */
public class NodeJsMobile {

  private static final String TAG = "NODEJS-MIKEOSS";
  private static final String NODEJS_PROJECT_DIR = "nodejs-project";
  private static final String SHARED_PREFS = "NODEJS_MOBILE_PREFS";
  private static final String LAST_UPDATED_TIME = "NODEJS_MOBILE_APK_LastUpdateTime";

  private static Context appContext;
  private static String filesDirPath;
  private static String nodeJsProjectPath;

  private static long lastUpdateTime = 1;
  private static long previousLastUpdateTime = 0;
  private static final Semaphore initSemaphore = new Semaphore(1);
  private static boolean initCompleted = false;
  private static boolean initialized = false;

  private static AssetManager assetManager;

  // Node only ever needs to be started once per process.
  private static boolean startedNodeAlready = false;

  static {
    System.loadLibrary("mikeoss-nodejs-mobile");
    System.loadLibrary("node");
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Call once from MainActivity.onCreate before starting the project. */
  public static synchronized void init(Context context) {
    if (initialized) return;
    initialized = true;
    appContext = context.getApplicationContext();
    filesDirPath = appContext.getFilesDir().getAbsolutePath();
    nodeJsProjectPath = filesDirPath + "/" + NODEJS_PROJECT_DIR;
    assetManager = appContext.getAssets();

    // Set the TMPDIR environment to the cacheDir, to be used in Node as
    // os.tmpdir().
    try {
      Os.setenv("TMPDIR", appContext.getCacheDir().getAbsolutePath(), true);
    } catch (ErrnoException e) {
      e.printStackTrace();
    }

    // Register the filesDir as the Node data dir.
    registerNodeDataDirPath(filesDirPath);

    asyncInit();
  }

  /** Starts dist/index.js inside the embedded Node runtime. */
  public static synchronized void startNodeProject(final String mainFile) {
    if (startedNodeAlready) return;
    startedNodeAlready = true;

    // Pin writable data/storage dirs to app-internal storage. Node's cwd in
    // the APK is '/'; without these the backend would default to
    // ./data under an unwritable root.
    try {
      Os.setenv("LOCAL_DATA_DIR", filesDirPath + "/mike-data", true);
      Os.setenv("LOCAL_STORAGE_DIR", filesDirPath + "/mike-data/storage", true);
    } catch (ErrnoException e) {
      e.printStackTrace();
    }

    new Thread(new Runnable() {
      @Override
      public void run() {
        waitForInit();
        Log.i(TAG, "Starting node project: " + nodeJsProjectPath + "/" + mainFile);
        Integer result = startNodeWithArguments(
            new String[]{"node", nodeJsProjectPath + "/" + mainFile},
            nodeJsProjectPath,
            true
        );
        Log.i(TAG, "node project exited with code " + result);
      }
    }).start();
  }

  // ---------------------------------------------------------------------------
  // Native bridge
  // ---------------------------------------------------------------------------

  public native void registerNodeDataDirPath(String dataDir);

  public native String getCurrentABIName();

  public native Integer startNodeWithArguments(
      String[] arguments,
      String modulesPath,
      boolean option_redirectOutputToLogcat);

  public native void sendMessageToNodeChannel(String channelName, String msg);

  // Called from JNI when node sends a message through the bridge.
  public static void sendMessageToApplication(String channelName, String msg) {
    Log.d(TAG, "[" + channelName + "] " + msg);
  }

  // ---------------------------------------------------------------------------
  // Asset installation
  // ---------------------------------------------------------------------------

  private static void asyncInit() {
    if (wasAPKUpdated()) {
      try {
        initSemaphore.acquire();
        new Thread(new Runnable() {
          @Override
          public void run() {
            try {
              copyNodeJsAssets();
              initCompleted = true;
            } catch (IOException e) {
              throw new RuntimeException("Node assets copy failed", e);
            } finally {
              initSemaphore.release();
            }
          }
        }).start();
      } catch (InterruptedException ie) {
        initSemaphore.release();
        ie.printStackTrace();
      }
    } else {
      initCompleted = true;
    }
  }

  private static void waitForInit() {
    if (!initCompleted) {
      try {
        initSemaphore.acquire();
        initSemaphore.release();
      } catch (InterruptedException ie) {
        initSemaphore.release();
        ie.printStackTrace();
      }
    }
  }

  private static boolean wasAPKUpdated() {
    android.content.SharedPreferences prefs =
        appContext.getSharedPreferences(SHARED_PREFS, Context.MODE_PRIVATE);
    previousLastUpdateTime = prefs.getLong(LAST_UPDATED_TIME, 0);

    try {
      PackageInfo packageInfo = appContext.getPackageManager().getPackageInfo(
          appContext.getPackageName(), 0);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        lastUpdateTime = packageInfo.lastUpdateTime;
      } else {
        lastUpdateTime = packageInfo.lastUpdateTime;
      }
    } catch (PackageManager.NameNotFoundException e) {
      e.printStackTrace();
    }
    return (lastUpdateTime != previousLastUpdateTime);
  }

  private static void saveLastUpdateTime() {
    android.content.SharedPreferences prefs =
        appContext.getSharedPreferences(SHARED_PREFS, Context.MODE_PRIVATE);
    android.content.SharedPreferences.Editor editor = prefs.edit();
    editor.putLong(LAST_UPDATED_TIME, lastUpdateTime);
    editor.commit();
  }

  private static void copyNodeJsAssets() throws IOException {
    // If a previous project folder is present, recreate it fresh so APK
    // updates ship new backend code.
    File nodeDirReference = new File(nodeJsProjectPath);
    if (nodeDirReference.exists()) {
      deleteFolderRecursively(nodeDirReference);
    }

    ArrayList<String> dirs = readFileFromAssets("dir.list");
    ArrayList<String> files = readFileFromAssets("file.list");

    if (dirs.size() > 0 && files.size() > 0) {
      Log.d(TAG, "Node assets copy using pre-built lists");
      for (String dir : dirs) {
        new File(filesDirPath + "/" + dir).mkdirs();
      }
      for (String file : files) {
        String dest = filesDirPath + "/" + file;
        copyAsset(file, dest);
      }
    } else {
      Log.d(TAG, "Node assets copy enumerating APK assets");
      copyAssetFolder(NODEJS_PROJECT_DIR, nodeJsProjectPath);
    }

    saveLastUpdateTime();
    Log.d(TAG, "Node assets copy completed successfully");
  }

  private static ArrayList<String> readFileFromAssets(String filename) {
    ArrayList<String> lines = new ArrayList<>();
    try {
      BufferedReader reader = new BufferedReader(
          new InputStreamReader(assetManager.open(filename)));
      String line = reader.readLine();
      while (line != null) {
        lines.add(line);
        line = reader.readLine();
      }
      reader.close();
    } catch (FileNotFoundException e) {
      Log.d(TAG, "File not found: " + filename);
    } catch (IOException e) {
      lines = new ArrayList<>();
      e.printStackTrace();
    }
    return lines;
  }

  private static void copyAssetFolder(String fromAssetPath, String toPath)
      throws IOException {
    String[] files = assetManager.list(fromAssetPath);

    if (files == null || files.length == 0) {
      copyAsset(fromAssetPath, toPath);
      return;
    }
    new File(toPath).mkdirs();
    for (String file : files) {
      copyAssetFolder(fromAssetPath + "/" + file, toPath + "/" + file);
    }
  }

  private static void copyAsset(String fromAssetPath, String toPath)
      throws IOException {
    InputStream in = null;
    OutputStream out = null;
    in = assetManager.open(fromAssetPath);
    new File(toPath).createNewFile();
    out = new FileOutputStream(toPath);
    copyFile(in, out);
    in.close();
    in = null;
    out.flush();
    out.close();
    out = null;
  }

  private static void copyFile(InputStream in, OutputStream out)
      throws IOException {
    byte[] buffer = new byte[8192];
    int read;
    while ((read = in.read(buffer)) != -1) {
      out.write(buffer, 0, read);
    }
  }

  private static boolean deleteFolderRecursively(File file) {
    try {
      boolean res = true;
      File[] children = file.listFiles();
      if (children != null) {
        for (File childFile : children) {
          if (childFile.isDirectory()) {
            res &= deleteFolderRecursively(childFile);
          } else {
            res &= childFile.delete();
          }
        }
      }
      res &= file.delete();
      return res;
    } catch (Exception e) {
      e.printStackTrace();
      return false;
    }
  }
}
