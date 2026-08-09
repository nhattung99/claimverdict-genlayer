// sampleClaimData.js
// Preset sample datasets for "File New Claim" test/demo helper — ClaimVerdict.

const CATEGORY_SAMPLES = {
  "Flight Cancellation & Delay": [
    {
      label: "Cancelled Flight Claim — Sample 1",
      evidenceUrls: [
        "https://www.federalregister.gov/documents/2024/04/26/2024-07177/refunds-and-other-consumer-protections",
      ],
      referenceUrls: [
        "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
        "https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard",
      ],
    },
    {
      label: "Flight Delay Exceeding 4 Hours — Sample 2",
      evidenceUrls: [
        "https://www.airhelp.com/en/flight-rights-usa/",
      ],
      referenceUrls: [
        "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
        "https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard",
      ],
    },
    {
      label: "No Alternative Carrier Connection — Sample 3",
      evidenceUrls: [
        "https://www.squaremouth.com/travel-advice/airline-passenger-rights",
      ],
      referenceUrls: [
        "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
        "https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard",
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
        "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
      ],
    },
    {
      label: "Delayed Luggage Exceeding 12 Hours — Sample 2",
      evidenceUrls: [
        "https://www.nerdwallet.com/travel/learn/delayed-baggage-compensation-broken-down-by-airline",
      ],
      referenceUrls: [
        "https://www.transportation.gov/lost-delayed-or-damaged-baggage",
        "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
      ],
    },
    {
      label: "Damaged Luggage Reimbursement — Sample 3",
      evidenceUrls: [
        "https://www.transportation.gov/briefing-room/emirates-fined-improperly-limiting-reimbursements-delayed-baggage",
      ],
      referenceUrls: [
        "https://www.transportation.gov/lost-delayed-or-damaged-baggage",
        "https://www.transportation.gov/individuals/aviation-consumer-protection/refunds",
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
        "https://travel.state.gov/en/international-travel/travel-advisories.html",
        "https://www.ftc.gov/enforcement/refunds",
      ],
    },
    {
      label: "International Schedule Modification — Sample 2",
      evidenceUrls: [
        "https://travel.state.gov/en/international-travel.html",
      ],
      referenceUrls: [
        "https://travel.state.gov/en/international-travel/travel-advisories.html",
        "https://www.ftc.gov/enforcement/refunds",
      ],
    },
    {
      label: "Personal Travel Emergency Cancellation — Sample 3",
      evidenceUrls: [
        "https://www.state.gov/travelers",
      ],
      referenceUrls: [
        "https://travel.state.gov/en/international-travel/travel-advisories.html",
        "https://www.ftc.gov/enforcement/refunds",
      ],
    },
  ],

  "Medical Emergency Abroad": [
    {
      label: "Overseas Medical Emergency Care — Sample 1",
      evidenceUrls: [
        "https://www.cdc.gov/yellow-book/index.html",
      ],
      referenceUrls: [
        "https://wwwnc.cdc.gov/travel",
        "https://wwwnc.cdc.gov/travel/notices",
      ],
    },
    {
      label: "Travel Outbreak Health Advisory — Sample 2",
      evidenceUrls: [
        "https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/travel-medicine-resources-for-healthcare-professionals.html",
      ],
      referenceUrls: [
        "https://wwwnc.cdc.gov/travel",
        "https://wwwnc.cdc.gov/travel/notices",
      ],
    },
    {
      label: "Urgent Outpatient Overseas Admission — Sample 3",
      evidenceUrls: [
        "https://wwwnc.cdc.gov/travel/page/traveler-information-center",
      ],
      referenceUrls: [
        "https://wwwnc.cdc.gov/travel",
        "https://wwwnc.cdc.gov/travel/notices",
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
        "https://www.cdc.gov/mmwr/volumes/68/wr/mm6820a6.htm",
      ],
    },
    {
      label: "Competitive Sports Concussion — Sample 2",
      evidenceUrls: [
        "https://archive.cdc.gov/www_cdc_gov/media/pressrel/r030702a.htm",
      ],
      referenceUrls: [
        "https://www.cdc.gov/heads-up/data/index.html",
        "https://www.cdc.gov/mmwr/volumes/68/wr/mm6820a6.htm",
      ],
    },
  ],

  "Rental Car Damage": [
    {
      label: "Rental Vehicle Collision Damage — Sample 1",
      evidenceUrls: [
        "https://search.ftc.gov/news-events/news/press-releases/1996/12/collision-damage-waiver-insurance-may-benefit-consumers",
      ],
      referenceUrls: [
        "https://consumer.ftc.gov/articles/renting-car",
        "https://www.ftc.gov/enforcement/refunds",
      ],
    },
    {
      label: "Collision Damage Waiver Dispute — Sample 2",
      evidenceUrls: [
        "https://www.ftc.gov/news-events/news/press-releases/1996/03/budget-rent-car",
      ],
      referenceUrls: [
        "https://consumer.ftc.gov/articles/renting-car",
        "https://www.ftc.gov/enforcement/refunds",
      ],
    },
    {
      label: "Rental Vehicle Body Repair Claim — Sample 3",
      evidenceUrls: [
        "https://www.123carrental.com/en/us-car-rental-rights",
      ],
      referenceUrls: [
        "https://consumer.ftc.gov/articles/renting-car",
        "https://www.ftc.gov/enforcement/refunds",
      ],
    },
  ],

  "Event Cancellation": [
    {
      label: "Official Concert Cancellation Notice — Sample 1",
      evidenceUrls: [
        "https://www.federalregister.gov/documents/2025/01/10/2024-30293/trade-regulation-rule-on-unfair-or-deceptive-fees",
      ],
      referenceUrls: [
        "https://www.ftc.gov/news-events/news/press-releases/2024/12/federal-trade-commission-announces-bipartisan-rule-banning-junk-ticket-hotel-fees",
        "https://consumer.ftc.gov/search-terms/refunds",
      ],
    },
    {
      label: "Event Refund Non-Fulfillment — Sample 2",
      evidenceUrls: [
        "https://www.britannica.com/money/junk-fees-rule",
      ],
      referenceUrls: [
        "https://www.ftc.gov/news-events/news/press-releases/2024/12/federal-trade-commission-announces-bipartisan-rule-banning-junk-ticket-hotel-fees",
        "https://consumer.ftc.gov/search-terms/refunds",
      ],
    },
    {
      label: "Event Ticket Fee Dispute — Sample 3",
      evidenceUrls: [
        "https://consumer.ftc.gov/consumer-alerts/2026/04/did-you-buy-tickets-stubhub-between-may-12-14-last-year",
      ],
      referenceUrls: [
        "https://www.ftc.gov/news-events/news/press-releases/2024/12/federal-trade-commission-announces-bipartisan-rule-banning-junk-ticket-hotel-fees",
        "https://consumer.ftc.gov/search-terms/refunds",
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
