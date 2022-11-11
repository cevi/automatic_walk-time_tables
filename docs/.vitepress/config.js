export default {

    lang: 'en-US',

    title: 'Cevi.Tools',
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
                text: 'Changelog', link: '/changelog/changelog'
            },
            {
                text: 'Documentation', link: '/documentation/introduction/getting-started'
            }
        ],

        sidebar: {
            '/documentation/': [
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
                            text: 'Runtime Modes & Environments', link: '/documentation/introduction/environment'
                        },
                    ]
                },
                {
                    text: 'Frontend/Webinterface',
                    collapsible: true,
                    collapsed: true,
                    items: [
                        {
                            text: 'About', link: '/documentation/frontend/about'
                        },
                        {
                            text: 'Local Setup', link: '/documentation/frontend/local-setup'
                        },
                    ]
                },
                {
                    text: 'Backend & API',
                    collapsible: true,
                    collapsed: true,
                    items: [
                        {
                            text: 'About', link: '/documentation/backend/about'
                        },
                        {
                            text: 'API Endpoints', link: '/documentation/backend/API_endpoints'
                        },
                        {
                            text: 'Utilities and Helper Scripts', link: '/documentation/backend/helper_scripts'
                        },
                        {
                            text: 'Command Line Arguments', link: '/documentation/backend/command_line_arguments'
                        }
                    ]
                },
                {
                    text: 'Swiss TLM API',
                    collapsible: true,
                    collapsed: true,
                    items: [
                        {
                            text: 'About', link: '/documentation/swiss_TLM_API/about'
                        },
                        {
                            text: 'API Endpoints', link: '/documentation/swiss_TLM_API/API_endpoints'
                        },
                        {
                            text: 'Testing', link: '/documentation/swiss_TLM_API/testing'
                        },
                    ]
                },
                {
                    text: 'PDF Creator',
                    collapsible: true,
                    collapsed: true,
                    items: [
                        {
                            text: 'About', link: '/documentation/mapfish_print_server/about'
                        },
                    ]
                },
                {
                    text: 'Routing Engine',
                    collapsible: true,
                    collapsed: true,
                    items: [
                        {
                            text: 'About', link: '/documentation/routing_engine/about'
                        },
                    ]
                },
                {
                    text: 'Documentation',
                    collapsible: true,
                    collapsed: true,
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
            ]
        },

    }

}