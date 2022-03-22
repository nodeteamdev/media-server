module.exports = {
    apps: [{
        name: 'media-server',
        script: 'dist/main.js',
        max_memory_restart: '900M',
        instances: 1,
    }],
};
