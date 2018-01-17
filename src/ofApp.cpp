#include "ofApp.h"

//--------------------------------------------------------------
void ofApp::setup(){
    // set the basic info
    ofSetFrameRate( 60 );
    ofSetVerticalSync( true );
    ofBackground(0);
    
    // load shader
    shader.load("shaders/shader.vert", "shaders/shader.frag");

    exp.setup(ofGetWidth(), ofGetHeight(), 30);
    exp.setFrameRange(0, 500);
    exp.setOutputDir("out");
    exp.setOverwriteSequence(true);
    exp.setAutoExit(true);
    exp.startExport();
}

//--------------------------------------------------------------
void ofApp::update(){

}

//--------------------------------------------------------------
void ofApp::draw(){
//    exp.begin();
//    ofClear(0);
    
    ofSetWindowTitle("FPS : " + ofToString(ofGetFrameRate()));
    
    shader.begin();
    shader.setUniform1f("u_time", ofGetElapsedTimef());
    shader.setUniform2f("u_resolution", ofGetWidth(), ofGetHeight());
    ofDrawRectangle(0, 0, ofGetWidth(), ofGetHeight());
    shader.end();
    
//    exp.end();
//    exp.draw(0, 0);
}

//--------------------------------------------------------------
void ofApp::keyPressed(int key){

}

//--------------------------------------------------------------
void ofApp::keyReleased(int key){

}

//--------------------------------------------------------------
void ofApp::mouseMoved(int x, int y ){

}

//--------------------------------------------------------------
void ofApp::mouseDragged(int x, int y, int button){

}

//--------------------------------------------------------------
void ofApp::mousePressed(int x, int y, int button){

}

//--------------------------------------------------------------
void ofApp::mouseReleased(int x, int y, int button){

}

//--------------------------------------------------------------
void ofApp::mouseEntered(int x, int y){

}

//--------------------------------------------------------------
void ofApp::mouseExited(int x, int y){

}

//--------------------------------------------------------------
void ofApp::windowResized(int w, int h){

}

//--------------------------------------------------------------
void ofApp::gotMessage(ofMessage msg){

}

//--------------------------------------------------------------
void ofApp::dragEvent(ofDragInfo dragInfo){ 

}
