cmake_minimum_required(VERSION 3.18.1)
project("mikeoss-nodejs-mobile")

add_library(
             mikeoss-nodejs-mobile

             SHARED

             src/main/cpp/native-lib.cpp
             src/main/cpp/rn-bridge.cpp
           )

include_directories(src/main/cpp/)
include_directories(libnode-include/node/)

add_library( libnode
             SHARED
             IMPORTED )

set_target_properties( libnode
                       PROPERTIES IMPORTED_LOCATION
                       ${CMAKE_SOURCE_DIR}/src/main/jniLibs/${ANDROID_ABI}/libnode.so )

find_library( log-lib
              log )

target_link_libraries( mikeoss-nodejs-mobile

                       libnode

                       ${log-lib} )
