// Sample datasets for "File New Claim".
// Evidence hosts MUST be distinct from the two enrolled authoritative reference hosts.

const CATEGORY_SAMPLES = {
  "Flight Cancellation & Delay": [
    {
      label: "Cancelled Flight Claim — Sample 1",
      evidenceUrls: [
        "https://www.airhelp.com/en/flight-rights-usa/",
      ],
      referenceUrls: [
        "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
        "https://www.federalregister.gov/documents/2024/04/26/2024-07177/refunds-and-other-consumer-protections",
      ],
    },
    {
      label: "Flight Delay Exceeding 4 Hours — Sample 2",
      evidenceUrls: [
        "https://www.squaremouth.com/travel-advice/airline-passenger-rights",
      ],
      referenceUrls: [
        "https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard",
        "https://www.federalregister.gov/documents/2024/04/26/2024-07177/refunds-and-other-consumer-protections",
      ],
    },
    {
      label: "No Alternative Carrier Connection — Sample 3",
      evidenceUrls: [
        "https://www.airhelp.com/en/flight-delay-compensation/",
      ],
      referenceUrls: [
        "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
        "https://www.federalregister.gov/documents/2024/04/26/2024-07177/refunds-and-other-consumer-protections",
      ],
    },
  ],

  "Baggage Loss/Delay": [
    {
      label: "Lost Baggage Official Report — Sample 1",
      evidenceUrls: [
        "https://www.findlaw.com/consumer/travel-rules-and-rights/lost-baggage-compensation-and-the-law.html",
      ],
      referenceUrls: [
        "https://www.transportation.gov/lost-delayed-or-damaged-baggage",
        "https://www.iata.org/en/programs/ops-infra/baggage/",
      ],
    },
    {
      label: "Delayed Luggage Exceeding 12 Hours — Sample 2",
      evidenceUrls: [
        "https://www.nerdwallet.com/travel/learn/delayed-baggage-compensation-broken-down-by-airline",
      ],
      referenceUrls: [
        "https://www.transportation.gov/lost-delayed-or-damaged-baggage",
        "https://www.iata.org/en/programs/ops-infra/baggage/",
      ],
    },
    {
      label: "Damaged Luggage Reimbursement — Sample 3",
      evidenceUrls: [
        "https://www.findlaw.com/consumer/travel-rules-and-rights/lost-baggage-compensation-and-the-law.html",
      ],
      referenceUrls: [
        "https://www.transportation.gov/briefing-room/emirates-fined-improperly-limiting-reimbursements-delayed-baggage",
        "https://www.iata.org/en/programs/ops-infra/baggage/",
      ],
    },
  ],

  "Trip Cancellation": [
    {
      label: "Trip Cancelled due to Travel Advisory — Sample 1",
      evidenceUrls: [
        "https://www.usa.gov/travel-advisory",
      ],
      referenceUrls: [
        "https://www.weather.gov/",
        "https://travel.state.gov/en/international-travel/travel-advisories.html",
      ],
    },
    {
      label: "International Schedule Modification — Sample 2",
      evidenceUrls: [
        "https://www.usa.gov/visas-and-passports",
      ],
      referenceUrls: [
        "https://www.weather.gov/safety/",
        "https://travel.state.gov/en/international-travel.html",
      ],
    },
    {
      label: "Personal Travel Emergency Cancellation — Sample 3",
      evidenceUrls: [
        "https://www.usa.gov/disaster-financial-help",
      ],
      referenceUrls: [
        "https://www.weather.gov/",
        "https://travel.state.gov/en/international-travel/travel-advisories.html",
      ],
    },
  ],

  "Medical Emergency Abroad": [
    {
      label: "Overseas Medical Emergency Care — Sample 1",
      evidenceUrls: [
        "https://medlineplus.gov/travelershealth.html",
      ],
      referenceUrls: [
        "https://www.who.int/travel-advice",
        "https://www.cdc.gov/travel/index.html",
      ],
    },
    {
      label: "Travel Outbreak Health Advisory — Sample 2",
      evidenceUrls: [
        "https://medlineplus.gov/infections.html",
      ],
      referenceUrls: [
        "https://www.who.int/emergencies/disease-outbreak-news",
        "https://www.cdc.gov/travel/notices",
      ],
    },
    {
      label: "Urgent Outpatient Overseas Admission — Sample 3",
      evidenceUrls: [
        "https://medlineplus.gov/emergencyandfirefighters.html",
      ],
      referenceUrls: [
        "https://www.who.int/health-topics/travel-and-health",
        "https://www.cdc.gov/travel/page/traveler-information-center",
      ],
    },
  ],

  "Amateur Sports Injury": [
    {
      label: "Amateur Tournament Injury — Sample 1",
      evidenceUrls: [
        "https://www.chop.edu/centers-programs/injury-prevention-program/sports-safety",
      ],
      referenceUrls: [
        "https://www.cdc.gov/heads-up/data/index.html",
        "https://www.who.int/news-room/fact-sheets/detail/injuries-and-violence",
      ],
    },
    {
      label: "Competitive Sports Concussion — Sample 2",
      evidenceUrls: [
        "https://www.chop.edu/centers-programs/injury-prevention-program",
      ],
      referenceUrls: [
        "https://www.cdc.gov/heads-up/about/index.html",
        "https://www.who.int/news-room/fact-sheets/detail/injuries-and-violence",
      ],
    },
    {
      label: "Match-Play Acute Injury — Sample 3",
      evidenceUrls: [
        "https://www.chop.edu/health-resources/sports-injury-prevention",
      ],
      referenceUrls: [
        "https://www.cdc.gov/mmwr/volumes/68/wr/mm6820a6.htm",
        "https://www.who.int/news-room/fact-sheets/detail/injuries-and-violence",
      ],
    },
  ],

  "Rental Car Damage": [
    {
      label: "Rental Vehicle Collision Damage — Sample 1",
      evidenceUrls: [
        "https://www.123carrental.com/en/us-car-rental-rights",
      ],
      referenceUrls: [
        "https://www.nhtsa.gov/",
        "https://www.ftc.gov/enforcement/refunds",
      ],
    },
    {
      label: "Collision Damage Waiver Dispute — Sample 2",
      evidenceUrls: [
        "https://www.123carrental.com/en/us-car-rental-rights",
      ],
      referenceUrls: [
        "https://www.nhtsa.gov/road-safety",
        "https://consumer.ftc.gov/articles/renting-car",
      ],
    },
    {
      label: "Rental Vehicle Body Repair Claim — Sample 3",
      evidenceUrls: [
        "https://www.123carrental.com/en/us-car-rental-rights",
      ],
      referenceUrls: [
        "https://www.nhtsa.gov/equipment/tires",
        "https://www.ftc.gov/news-events/topics/consumer-finance",
      ],
    },
  ],

  "Event Cancellation": [
    {
      label: "Official Concert Cancellation Notice — Sample 1",
      evidenceUrls: [
        "https://www.britannica.com/money/junk-fees-rule",
      ],
      referenceUrls: [
        "https://www.federalregister.gov/documents/2025/01/10/2024-30293/trade-regulation-rule-on-unfair-or-deceptive-fees",
        "https://www.ftc.gov/news-events/news/press-releases/2024/12/federal-trade-commission-announces-bipartisan-rule-banning-junk-ticket-hotel-fees",
      ],
    },
    {
      label: "Event Refund Non-Fulfillment — Sample 2",
      evidenceUrls: [
        "https://www.britannica.com/money/Federal-Trade-Commission",
      ],
      referenceUrls: [
        "https://www.federalregister.gov/documents/2025/01/10/2024-30293/trade-regulation-rule-on-unfair-or-deceptive-fees",
        "https://www.ftc.gov/news-events/topics/consumer-protection",
      ],
    },
    {
      label: "Event Ticket Fee Dispute — Sample 3",
      evidenceUrls: [
        "https://www.britannica.com/topic/ticket",
      ],
      referenceUrls: [
        "https://www.federalregister.gov/",
        "https://www.ftc.gov/enforcement/refunds",
      ],
    },
  ],
};

export const SAMPLE_CLAIM_DATA = {
  ...CATEGORY_SAMPLES,
  "Flight Cancellation & Delay": CATEGORY_SAMPLES["Flight Cancellation & Delay"],
  "Amateur Sports Injury Reimbursement": CATEGORY_SAMPLES["Amateur Sports Injury"],
  "Travel & Trip Cancellation": CATEGORY_SAMPLES["Trip Cancellation"],
  "Emergency Travel Medical Insurance": CATEGORY_SAMPLES["Medical Emergency Abroad"],
  "Lost & Damaged Luggage Protection": CATEGORY_SAMPLES["Baggage Loss/Delay"],
  "Rental Vehicle Collision & Damage": CATEGORY_SAMPLES["Rental Car Damage"],
  "Concert & Event Ticket Protection": CATEGORY_SAMPLES["Event Cancellation"]
};
