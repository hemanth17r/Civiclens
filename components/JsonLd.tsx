'use client';

import React from 'react';

export default function JsonLd() {
    const organizationSchema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': 'CivicLens',
        'url': 'https://civiclens.tech',
        'logo': 'https://civiclens.tech/icon-512.png',
        'sameAs': [
            'https://twitter.com/civiclens', // Placeholder if you have social
            'https://github.com/hemanth17r/Civiclens'
        ],
        'description': 'CivicLens is a community-driven civic accountability platform where citizens report infrastructure issues and track their resolution through trust-weighted voting.',
    };

    const websiteSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'CivicLens',
        'url': 'https://civiclens.tech',
        'potentialAction': {
            '@type': 'SearchAction',
            'target': 'https://civiclens.tech/explore?q={search_term_string}',
            'query-input': 'required name=search_term_string'
        }
    };

    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
            {
                '@type': 'Question',
                'name': 'What is CivicLens?',
                'acceptedAnswer': {
                    '@type': 'Answer',
                    'text': 'CivicLens is a civic reporting platform that empowers citizens to report local infrastructure issues like potholes, waste, and lighting problems. It uses a trust-weighted voting system to verify reports and hold officials accountable.'
                }
            },
            {
                '@type': 'Question',
                'name': 'How does the CivicLens trust engine work?',
                'acceptedAnswer': {
                    '@type': 'Answer',
                    'text': 'The CivicLens trust engine assigns a trust score to every user based on their history of accurate reporting and voting. Higher trust scores give more weight to a user\'s votes in the issue lifecycle.'
                }
            },
            {
                '@type': 'Question',
                'name': 'How do I report a civic issue in India?',
                'acceptedAnswer': {
                    '@type': 'Answer',
                    'text': 'To report a civic issue on CivicLens, simply log in, select your city, upload a photo of the issue (potholes, waste, etc.), and provide a description. The community will then verify the report through the five-stage lifecycle.'
                }
            },
            {
                '@type': 'Question',
                'name': 'What are the 5 stages of an issue lifecycle in CivicLens?',
                'acceptedAnswer': {
                    '@type': 'Answer',
                    'text': 'The five stages are: Reported (Initial submission), Verification Needed (Community verification), Active (Confirmed issue), Action Seen (Work started), and Resolved (Fixed and verified).'
                }
            }
        ]
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
        </>
    );
}
