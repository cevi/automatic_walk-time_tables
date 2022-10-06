export default {

    lang: 'en-US',

    title: ' ',
    description: 'Automatic Walk-Time Tables',

    // TODO: configure nginx to support this!
    // cleanUrls: 'without-subfolders',

    themeConfig: {

        // logo: '/imgs/logo.svg',

        nav: [
            {
                text: 'Home', link: '/'
            },
            {
                text: 'Documentation', link: 'documentation'
            }
        ],

        sidebar: [
            {
                text: 'Introduction',
                items: [
                    {
                        text: 'Getting Started', link: '/documentation/introduction/getting-started'
                    },
                    {
                        text: 'Application Structure', link: '/documentation/introduction/structure'
                    },
                    {
                        text: 'Environments', link: '/documentation/introduction/environment'
                    },
                ]
            },
            {
                text: 'Webinterface',
                collapsible: true,
                items: [
                     {
                        text: 'About', link: '/documentation/webinterface/about'
                    },
                ]
            },
            {
                text: 'Backend & API',
                collapsible: true,
                items: []
            },
            {
                text: 'PDF Creator',
                collapsible: true,
                items: []
            },
            {
                text: 'Route Server',
                collapsible: true,
                items: []
            },
            {
                text: 'Route Server',
                collapsible: true,
                items: [
                      {
                        text: 'About', link: '/documentation/documentation/about'
                    },
                ]
            }
        ],
        editLink: {
            pattern: 'https://github.com/cevi/automatic_walk-time_tables/edit/master/docs/:path',
            text: 'Edit this page on GitHub'
        },
        socialLinks: [
            {
                icon: 'github', link: 'https://github.com/cevi/automatic_walk-time_tables'
            }
        ],

    }

}