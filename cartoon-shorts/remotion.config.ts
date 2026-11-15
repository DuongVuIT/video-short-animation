import { Config } from "@remotion/cli/config";

// three.js needs a real GPU context in headless Chrome; ANGLE uses Metal on Apple Silicon.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
